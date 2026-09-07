/* The referee. Every rule a student could argue about is pinned here.

   Most tests build their own little arena rather than using a shipped one,
   because "the mechs start two tiles apart, facing each other" is the whole
   setup for half of them and a real map buries it. */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../public/mechsim.js');

let uid=1;
const B = (type,extra) => Object.assign({id:uid++,type}, extra||{});
const rep = (n,body) => B('repeat',{count:n,body});
const iff = (c,body) => B('ifc',{cond:c,body});
const until = (c,body) => B('until',{cond:c,body});

/* a strip of floor with the two mechs on it, facing each other */
const strip = (row) => ({ id:'strip', name:'STRIP', grid:[
  '#'.repeat(row.length+2),
  '#'+row+'#',
  '#'.repeat(row.length+2)
]});
const box = (rows) => ({ id:'box', name:'BOX', grid:rows });

function run(pa, pb, opts){
  opts=opts||{};
  const rules=Object.assign({}, opts.rules);
  if(opts.turns) rules.maxTurns=opts.turns;
  return M.simulate({
    a:{name:'Ada', chassis:opts.ca||'striker', program:pa, dir:opts.da},
    b:{name:'Bo',  chassis:opts.cb||'striker', program:pb, dir:opts.db},
    arena:opts.arena||strip('1......2'),
    rules, seed:opts.seed==null?1:opts.seed
  });
}
const at = (r,turn,side) => r.frames[turn].mechs[side==='A'?0:1];
const evs = (r,turn,side) => r.log[turn-1][side];
const said = (r,turn,side,text) => evs(r,turn,side).some(e=>e.text===text);

/* ------------------------------------------------------------- movement */

test('forward moves one tile the way the mech is facing', ()=>{
  const r=run([B('forward')],[B('shield')]);
  assert.strictEqual(at(r,0,'A').x, 1);
  assert.strictEqual(at(r,1,'A').x, 2);
  assert.strictEqual(at(r,1,'A').dir, at(r,0,'A').dir);
});

test('back reverses without turning round', ()=>{
  const r=run([B('back')],[B('shield')], {arena:strip('.1.....2')});
  assert.strictEqual(at(r,1,'A').x, 1);
  assert.strictEqual(at(r,1,'A').dir, at(r,0,'A').dir);
});

test('a scout covers two tiles per step and a tank one', ()=>{
  const r=run([B('forward')],[B('forward')],{ca:'scout',cb:'tank',arena:strip('1........2')});
  assert.strictEqual(at(r,1,'A').x - at(r,0,'A').x, 2);
  assert.strictEqual(at(r,0,'B').x - at(r,1,'B').x, 1);
});

test('turning left four times comes back to where it started', ()=>{
  const r=run([rep(4,[B('left')])],[B('shield')]);
  assert.strictEqual(at(r,4,'A').dir, at(r,0,'A').dir);
});

test('a mech cannot walk through a wall, and is told so', ()=>{
  const r=run([rep(6,[B('forward')])],[B('shield')],{arena:box([
    '######','#1.#2#','######'])});
  assert.strictEqual(at(r,6,'A').x, 2);          // stopped at the wall, not past it
  assert.ok(said(r,2,'A','wall'));
});

test('dash covers two tiles but stops at a wall like anything else', ()=>{
  const r=run([B('dash')],[B('shield')],{arena:box(['######','#1.#.2','######'])});
  assert.strictEqual(at(r,1,'A').x, 2);
});

/* ------------------------------------------------------------ collision */

test('two mechs going for the same tile both stay put and both take a knock', ()=>{
  const r=run([B('forward')],[B('forward')],{arena:strip('1.2')});
  assert.deepStrictEqual([at(r,1,'A').x, at(r,1,'B').x], [1,3]);
  assert.ok(said(r,1,'A','collision') && said(r,1,'B','collision'));
  assert.ok(at(r,1,'A').hp < at(r,0,'A').hp);
});

test('two mechs cannot swap places through each other', ()=>{
  // nose to nose: east and west, one tile apart
  const r=run([B('forward')],[B('forward')],
    {arena:strip('.12....'), da:1, db:3, turns:1});
  assert.deepStrictEqual([at(r,1,'A').x, at(r,1,'B').x], [2,3]);
  assert.ok(said(r,1,'A','collision') && said(r,1,'B','collision'));
});

test('a standing mech is as solid as a wall, and stops you without hurting you', ()=>{
  const r=run([B('forward')],[B('shield')],
    {arena:strip('.12....'), da:1, turns:1});
  assert.strictEqual(at(r,1,'A').x, 2);          // did not move onto the other mech
  assert.ok(said(r,1,'A','blocked'));
  assert.strictEqual(at(r,1,'A').hp, at(r,0,'A').hp);
});

/* ------------------------------------------------------------- sensing */

test('enemy ahead is true down the line and false across it', ()=>{
  const seen=run([iff('enemy ahead',[B('shoot')])],[B('shield')],{arena:strip('1..2')});
  assert.ok(seen.stats.A.shots > 0);
  const blind=run([iff('enemy ahead',[B('shoot')])],[B('shield')],{arena:box([
    '#####','#1..#','#...#','#..2#','#####'])});
  assert.strictEqual(blind.stats.A.shots, 0);
});

test('enemy ahead is false through a wall', ()=>{
  const r=run([iff('enemy ahead',[B('shoot')])],[B('shield')],{arena:box([
    '######','#1.#2#','######'])});
  assert.strictEqual(r.stats.A.shots, 0);
});

test('enemy ahead is false beyond the gun range', ()=>{
  const r=run([iff('enemy ahead',[B('shoot')])],[B('shield')],
    {ca:'tank', arena:strip('1.......2')});    // tank reaches 3, the gap is 7
  assert.strictEqual(r.stats.A.shots, 0);
});

test('wall ahead sees the wall one tile before it is hit', ()=>{
  const r=run([until('wall ahead',[B('forward')])],[B('shield')],{arena:strip('1......2')});
  const a=at(r,60,'A');
  assert.ok(a.x < 8);                          // it stopped rather than shoving
  assert.ok(!said(r,60,'A','wall'));
});

test('enemy nearby is two tiles, and enemy detected is the sensor range', ()=>{
  const near=run([iff('enemy nearby',[B('shield')])],[B('shield')],{arena:strip('1.2')});
  assert.ok(said(near,1,'A','shield up'));
  const far=run([iff('enemy nearby',[B('shield')])],[B('shield')],{arena:strip('1.....2')});
  assert.ok(!said(far,1,'A','shield up'));
  const det=run([iff('enemy detected',[B('shield')])],[B('shield')],
    {ca:'scout', arena:strip('1.....2')});     // scout sees six
  assert.ok(said(det,1,'A','shield up'));
});

test('energy nearby finds a crate and goes quiet once it is taken', ()=>{
  const r=run([iff('energy nearby',[B('forward')])],[B('shield')],
    {arena:box(['#####','#1E.#','#...#','#..2#','#####'])});
  assert.strictEqual(at(r,1,'A').x, 2);        // walked onto it
  assert.ok(said(r,1,'A','picked up energy'));
});

/* -------------------------------------------------------------- combat */

test('a hit takes attack less armour, and never less than one', ()=>{
  // striker hits for 5, tank soaks 2
  const r=run([B('shoot')],[B('left')],{cb:'tank', arena:strip('1.2'), turns:1});
  assert.strictEqual(at(r,0,'B').hp - at(r,1,'B').hp, 3);
  assert.strictEqual(r.stats.A.damageDealt, 3);
  // and a pea-shooter against the thickest armour still gets through for one
  const floor=run([B('shoot')],[B('shield')],
    {ca:'defender', cb:'tank', arena:strip('1.2'), turns:1});
  assert.strictEqual(floor.stats.A.damageDealt, 1);
});

test('a raised shield soaks damage on the turn it goes up', ()=>{
  const bare=run([B('shoot')],[B('left')],  {arena:strip('1.2'), turns:1});
  const held=run([B('shoot')],[B('shield')],{arena:strip('1.2'), turns:1});
  assert.ok(held.stats.A.damageDealt < bare.stats.A.damageDealt);
  assert.ok(said(held,1,'B','shield up'));
});

test('a shield only lasts the turn it was raised', ()=>{
  // A holds for a turn while B braces, then fires the turn after
  const r=run([B('shield'),B('shoot')],[B('shield'),B('left')],
    {arena:strip('1.2'), turns:2});
  assert.strictEqual(at(r,2,'B').shield, false);
  assert.strictEqual(r.stats.A.damageDealt, 4);   // 5 attack through 1 armour, unshielded
});

test('a defender shrugs off more than a scout', ()=>{
  const soft=run([B('shoot')],[B('left')],{cb:'scout',   arena:strip('1.2'), turns:1});
  const hard=run([B('shoot')],[B('left')],{cb:'defender',arena:strip('1.2'), turns:1});
  assert.strictEqual(soft.stats.A.damageDealt, 5);
  assert.strictEqual(hard.stats.A.damageDealt, 2);
});

test('a shot at nothing is a miss, and says what was not there', ()=>{
  const r=run([B('shoot')],[B('shield')],{arena:strip('1.......2'), turns:1});
  assert.strictEqual(r.stats.A.hits, 0);
  assert.strictEqual(r.stats.A.shots, 1);
  const miss=evs(r,1,'A').find(e=>e.text==='miss');
  assert.match(miss.why, /within 4 tiles/);
});

test('shots resolve after movement, so a mech can step out of the line', ()=>{
  const r=run([B('shoot')],[B('left'),B('forward')],{arena:box([
    '#####','#1.2#','#...#','#####'])});
  assert.ok(r.stats.A.shots>0);
});

/* -------------------------------------------------------------- energy */

test('every action costs what the rules say and nothing else', ()=>{
  const r=run([B('shoot')],[B('shield')],{arena:strip('1.2'), turns:1});
  assert.strictEqual(r.stats.A.energyUsed, r.rules.cost.shoot);
  assert.strictEqual(r.stats.B.energyUsed, r.rules.cost.shield);
});

test('turning is free in energy but still costs the turn', ()=>{
  const r=run([B('left')],[B('shield')],{arena:strip('1.2')});
  assert.strictEqual(r.stats.A.energyUsed, 0);
  assert.notStrictEqual(at(r,1,'A').dir, at(r,0,'A').dir);
});

test('costs are configurable rather than baked in', ()=>{
  const r=run([B('shoot')],[B('shield')],
    {arena:strip('1.2'), turns:1, rules:{cost:{shoot:9}}});
  assert.strictEqual(r.stats.A.energyUsed, 9);
});

test('a mech that cannot afford an action stalls, and is told the numbers', ()=>{
  const r=run([rep(20,[B('shoot')])],[B('shield')],
    {arena:strip('1.2'), rules:{ regen:0, startEnergy:5, cost:{shoot:3} }});
  const stall=r.log.map(l=>l.A).flat().find(e=>e.kind==='stall');
  assert.ok(stall, 'expected a stall once the tank ran dry');
  assert.match(stall.why, /costs 3 energy, and it had 2/);
});

test('energy comes back each turn, so nobody is stranded for ever', ()=>{
  const r=run([B('shield')],[B('shield')],{arena:strip('1.....2'),
    rules:{ startEnergy:2, cost:{shield:2} }});
  assert.ok(at(r,4,'A').energy >= 0);
  assert.ok(r.stats.A.energyUsed >= 4);
});

test('a crate refills, and cannot take a tank over its own maximum', ()=>{
  const r=run([B('forward')],[B('shield')],
    {arena:box(['#####','#1E.#','#..2#','#####'])});
  assert.ok(at(r,1,'A').energy <= r.mechs[0].maxEnergy);
  assert.ok(said(r,1,'A','picked up energy'));
});

/* ------------------------------------------------------------- hazards */

test('standing in a hazard hurts, every turn you stand in it', ()=>{
  const r=run([B('forward'),B('shield'),B('shield')],[B('shield')],
    {arena:box(['#####','#1X.#','#..2#','#####'])});
  assert.ok(said(r,1,'A','hazard'));
  assert.ok(at(r,2,'A').hp < at(r,1,'A').hp);
});

/* --------------------------------------------------------- the program */

test('a repeat really does repeat, and stops when it is done', ()=>{
  const r=run([rep(3,[B('forward')])],[B('shield')],{arena:strip('1......2')});
  assert.strictEqual(at(r,3,'A').x - at(r,0,'A').x, 3);
});

test('if / else the hard way: the false branch skips its body', ()=>{
  const r=run([iff('enemy ahead',[B('shoot')]), B('forward')],[B('shield')],
    {arena:strip('1......2'), turns:1});
  assert.strictEqual(r.stats.A.shots, 0);
  assert.ok(at(r,1,'A').x > at(r,0,'A').x);      // it fell through to forward
});

test('a test is written down with the answer it gave', ()=>{
  const r=run([iff('wall ahead',[B('shoot')]), B('forward')],[B('shield')],
    {arena:strip('1......2')});
  const test1=evs(r,1,'A').find(e=>e.kind==='test');
  assert.strictEqual(test1.cond,'wall ahead');
  assert.strictEqual(test1.value,false);
  assert.ok(test1.blockId);
});

test('repeat-until keeps going until the test comes true', ()=>{
  const r=run([until('enemy nearby',[B('forward')]), B('shoot')],[B('shield')],
    {arena:strip('1.....2')});
  assert.ok(r.stats.A.shots>0, 'it should walk in, then fire');
});

test('a program that runs out starts again from the top', ()=>{
  const r=run([B('forward')],[B('shield')],{arena:strip('1......2')});
  assert.ok(at(r,3,'A').x >= at(r,0,'A').x+2);
});

test('a program that runs out can be made to stop instead', ()=>{
  const r=run([B('forward')],[B('shield')],
    {arena:strip('1......2'), rules:{loopProgram:false}});
  assert.strictEqual(at(r,5,'A').x, at(r,1,'A').x);
  const idle=r.log[2].A.find(e=>e.kind==='stall');
  assert.match(idle.why, /ran off the end/);
});

test('a loop that spins without ever acting is caught and explained', ()=>{
  // "until enemy nearby" with nothing inside: the test can never change
  const r=run([until('enemy nearby',[])],[B('shield')],{arena:strip('1.....2')});
  const spin=r.log[0].A.find(e=>e.kind==='stall');
  assert.match(spin.why, /without ever doing anything/);
  assert.strictEqual(r.result.turns, r.rules.maxTurns);   // it did not hang
});

/* ------------------------------------------------------------- verdicts */

test('destroying the other mech ends the match there and then', ()=>{
  const r=run([rep(20,[B('shoot')])],[B('shield')],
    {ca:'tank', cb:'scout', arena:strip('1.2'), rules:{regen:9}});
  assert.strictEqual(r.result.winner,'A');
  assert.strictEqual(r.result.reason,'destroyed');
  assert.ok(r.result.turns < r.rules.maxTurns);
  assert.strictEqual(r.frames[r.frames.length-1].mechs[1].alive, false);
});

test('both destroyed on the same turn is a draw, not a race', ()=>{
  const p=[rep(30,[B('shoot')])];
  const r=run(p,p,{ca:'tank',cb:'tank',arena:strip('1.2'),rules:{regen:9}});
  assert.strictEqual(r.result.winner,'draw');
  assert.strictEqual(r.result.reason,'mutual');
  assert.deepStrictEqual(r.frames[r.frames.length-1].mechs.map(m=>m.alive),[false,false]);
});

test('identical programs against identical mechs cannot be won by either', ()=>{
  const p=[iff('enemy ahead',[B('shoot')]), B('forward')];
  const r=run(p,p,{arena:strip('1......2')});
  assert.strictEqual(r.result.winner,'draw');
  assert.strictEqual(r.stats.A.damageDealt, r.stats.B.damageDealt);
});

test('running out of turns is settled on armour left', ()=>{
  const r=run([B('shield')],[B('shoot')],{arena:strip('1.2'), turns:3});
  assert.strictEqual(r.result.reason,'hp');
  assert.strictEqual(r.result.winner,'B');
  assert.match(r.result.text,/Time ran out/);
});

test('two mechs that never fire are a draw on time', ()=>{
  const r=run([B('left')],[B('right')],{arena:strip('1.....2')});
  assert.strictEqual(r.result.winner,'draw');
  assert.strictEqual(r.result.reason,'time');
});

/* -------------------------------------------------------- determinism */

test('the same programs, arena and seed give the same fight every time', ()=>{
  const p=[iff('enemy ahead',[B('shoot')]), until('wall ahead',[B('forward')]), B('left')];
  const q=[iff('enemy nearby',[B('shield')]), B('forward'), B('shoot')];
  const one=run(p,q,{arena:'ruins',seed:12345});
  const two=run(p,q,{arena:'ruins',seed:12345});
  assert.deepStrictEqual(one.frames, two.frames);
  assert.deepStrictEqual(one.log, two.log);
  assert.deepStrictEqual(one.result, two.result);
});

test('a hundred runs of the same match agree with each other', ()=>{
  const p=[until('enemy detected',[B('forward')]), iff('enemy ahead',[B('shoot')]), B('right')];
  const first=JSON.stringify(run(p,p,{arena:'maze',seed:99}).frames);
  for(let i=0;i<100;i++)
    assert.strictEqual(JSON.stringify(run(p,p,{arena:'maze',seed:99}).frames), first);
});

test('every shipped arena runs a full match without falling over', ()=>{
  const p=[until('enemy detected',[B('forward')]), iff('enemy ahead',[B('shoot')]), B('right')];
  M.ARENAS.forEach(a=>{
    const r=run(p,p,{arena:a.id,seed:3});
    assert.strictEqual(r.ok, true, a.id);
    assert.ok(r.result.winner, a.id);
  });
});

test('every chassis can fight every other chassis', ()=>{
  const ids=Object.keys(M.CHASSIS);
  const p=[iff('enemy ahead',[B('shoot')]), B('forward')];
  ids.forEach(ca=>ids.forEach(cb=>{
    const r=run(p,p,{ca,cb,arena:'training',seed:5});
    assert.strictEqual(r.ok,true, ca+' vs '+cb);
  }));
});

/* ------------------------------------------------------------- replay */

test('there is one frame per turn, plus the board before anybody moved', ()=>{
  const r=run([B('forward')],[B('forward')],{arena:strip('1......2')});
  assert.strictEqual(r.frames.length, r.result.turns+1);
  assert.strictEqual(r.log.length, r.result.turns);
  assert.strictEqual(r.frames[0].turn, 0);
});

test('a frame is the whole board, so the replay can jump straight to it', ()=>{
  const r=run([B('forward')],[B('shoot')],{arena:'energy',seed:2});
  const f=r.frames[10];
  assert.strictEqual(f.mechs.length,2);
  ['x','z','dir','hp','energy','shield','alive'].forEach(k=>
    assert.ok(k in f.mechs[0], k));
  assert.ok(Array.isArray(f.crates));
});

test('the seed is kept with the match, so it can be re-run from the row', ()=>{
  const r=run([B('forward')],[B('shoot')],{seed:4242});
  assert.strictEqual(r.seed, 4242);
  assert.ok(r.arenaId);
});

/* ---------------------------------------------------- invalid programs */

test('a program over the block limit never reaches the arena', ()=>{
  const long=Array.from({length:30},()=>B('forward'));
  const r=run(long,[B('shoot')]);
  assert.strictEqual(r.ok,false);
  assert.strictEqual(r.rejected[0].side,'A');
  assert.match(r.rejected[0].errors[0].msg,/limit is 20/);
});

test('a program using a block this match does not offer is refused', ()=>{
  const r=M.simulate({ a:{program:[B('teleport')]}, b:{program:[B('shoot')]},
                       arena:'training', seed:1 });
  assert.strictEqual(r.ok,false);
  assert.strictEqual(r.rejected[0].errors[0].code,'not-allowed');
});

test('a match can narrow the blocks further than the mech can carry', ()=>{
  const r=M.simulate({ a:{program:[B('dash')]}, b:{program:[B('forward')]},
    arena:'training', seed:1, allow:['forward','left','right'] });
  assert.strictEqual(r.ok,false);
  assert.match(r.rejected[0].errors[0].msg,/dash/);
});

test('an empty program is refused rather than fought', ()=>{
  const r=run([],[B('shoot')]);
  assert.strictEqual(r.ok,false);
  assert.strictEqual(r.rejected[0].errors[0].code,'empty');
});

/* ------------------------------------------------------------ feedback */

test('losing on energy is explained with the turn and the numbers', ()=>{
  const r=run([rep(20,[B('shoot')])],[B('shield')],
    {arena:strip('1.2'), rules:{regen:0, startEnergy:5}});
  const why=M.explain(r,'A');
  assert.match(why, /^TURN \d+/);
  assert.match(why, /energy/);
});

test('firing at nothing all match is explained as firing at nothing', ()=>{
  const r=run([B('shoot')],[B('shield')],
    {arena:strip('1.......2'), rules:{regen:9}});
  assert.match(M.explain(r,'A'), /hit nothing/);
});

test('never firing at all is explained as never firing', ()=>{
  const r=run([B('left')],[B('shield')],{arena:strip('1.....2')});
  assert.match(M.explain(r,'A'), /never fired/);
});
