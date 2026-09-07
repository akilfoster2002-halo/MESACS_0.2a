/* The Gym's waiting room. What matters here is not the fighting — the
   referee has its own tests — but who is made to wait, who is sent back
   with an unplayable program, and whether the fight two browsers are
   about to replay is the one the server actually decided. */
const test = require('node:test');
const assert = require('node:assert');
const { Lobby, check, ARENA, RULES } = require('../server/mechmatch.js');
const MECHSIM = require('../public/mechsim.js');

let n = 1;
const bk = (type, extra) => Object.assign({ id:n++, type }, extra||{});
const rep = (count, body) => bk('repeat', { count, body });

const CHARGE = [rep(9, [bk('forward'), bk('shoot')])];
const SPIN   = [rep(9, [bk('shoot'), bk('right')])];

const player = (id, name, chassis, program) => ({ id, name, chassis, program });
const fixed  = () => new Lobby({ seed:()=>4242 });

test('the first to deploy waits, and the room is not told a fight happened', ()=>{
  const L = fixed();
  const r = L.add('meadow', player(1,'Alpha','striker',CHARGE));
  assert.equal(r.status, 'waiting');
  assert.ok(L.waiting('meadow'));
  assert.equal(L.waiting('meadow').name, 'Alpha');
});

test('the second to deploy gets a whole match back', ()=>{
  const L = fixed();
  L.add('meadow', player(1,'Alpha','striker',CHARGE));
  const r = L.add('meadow', player(2,'Bravo','tank',SPIN));
  assert.equal(r.status, 'matched');
  assert.equal(r.match.arena, ARENA);
  assert.equal(r.match.A.name, 'Alpha');       // first in line is side A
  assert.equal(r.match.B.name, 'Bravo');
  assert.ok(['A','B','draw'].includes(r.match.result.winner));
  assert.ok(r.match.result.turns > 0);
  assert.equal(L.waiting('meadow'), null);     // and the queue is empty again
});

test('both browsers can redraw the fight the server decided', ()=>{
  const L = fixed();
  L.add('meadow', player(1,'Alpha','striker',CHARGE));
  const M = L.add('meadow', player(2,'Bravo','tank',SPIN)).match;
  /* This is the whole architecture in one assertion: the inputs the two
     clients are sent, run through the same pure referee, come out as the
     same result the server recorded. If this ever fails, the fight a
     student watched is not the fight that counted. */
  const again = MECHSIM.simulate({ a:M.A, b:M.B, arena:M.arena,
                                   rules:M.rules, seed:M.seed });
  assert.ok(again.ok);
  assert.equal(again.result.winner, M.result.winner);
  assert.equal(again.result.turns,  M.result.turns);
  assert.equal(again.result.text,   M.result.text);
});

test('the same two programs fight the same fight twice', ()=>{
  const one = fixed(), two = fixed();
  one.add('meadow', player(1,'Alpha','striker',CHARGE));
  two.add('meadow', player(1,'Alpha','striker',CHARGE));
  const a = one.add('meadow', player(2,'Bravo','tank',SPIN)).match;
  const b = two.add('meadow', player(2,'Bravo','tank',SPIN)).match;
  assert.deepEqual(a.result, b.result);
});

test('an unplayable program never reaches the queue', ()=>{
  const L = fixed();
  const r = L.add('meadow', player(1,'Alpha','striker',[]));
  assert.equal(r.status, 'rejected');
  assert.equal(r.errors[0].code, 'empty');
  assert.equal(L.waiting('meadow'), null);   // nobody is left holding a slot
});

test('a program over the block limit is sent back with the number in it', ()=>{
  const L = fixed();
  const tooMany = [];
  for(let i=0;i<RULES.blockLimit+3;i++) tooMany.push(bk('forward'));
  const r = L.add('meadow', player(1,'Alpha','striker',tooMany));
  assert.equal(r.status, 'rejected');
  assert.match(r.errors[0].msg, /limit is 20/);
});

test('a block that is not in this match is refused by name', ()=>{
  const r = check([bk('setX',{n:2})]);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'not-allowed');
  assert.match(r.errors[0].msg, /setX/);
});

test('an unknown mech is refused rather than defaulted', ()=>{
  const L = fixed();
  const r = L.add('meadow', player(1,'Alpha','battleship',CHARGE));
  assert.equal(r.status, 'error');
});

test('deploying twice replaces your program instead of fighting yourself', ()=>{
  const L = fixed();
  L.add('meadow', player(1,'Alpha','striker',CHARGE));
  const r = L.add('meadow', player(1,'Alpha','tank',SPIN));
  assert.equal(r.status, 'waiting');
  assert.equal(L.waiting('meadow').chassis, 'tank');
});

test('two rooms wait separately', ()=>{
  const L = fixed();
  L.add('meadow', player(1,'Alpha','striker',CHARGE));
  const r = L.add('canyon', player(2,'Bravo','tank',SPIN));
  assert.equal(r.status, 'waiting');          // a different class, a different queue
  assert.equal(L.waiting('meadow').name, 'Alpha');
  assert.equal(L.waiting('canyon').name, 'Bravo');
});

test('leaving takes you out of the queue', ()=>{
  const L = fixed();
  L.add('meadow', player(1,'Alpha','striker',CHARGE));
  assert.equal(L.cancel(1), true);
  assert.equal(L.waiting('meadow'), null);
  assert.equal(L.cancel(1), false);           // and cancelling twice is not an error
});

test('the Gym floor is the same for both marks', ()=>{
  /* A tournament on an unfair map is a tournament decided by the map. The
     arena is turned half a circle and has to come out as itself, with the
     two starting marks swapped. */
  const g = MECHSIM.arenaById(ARENA).grid;
  const h = g.length, w = g[0].length;
  const swap = c => c==='1' ? '2' : c==='2' ? '1' : c;
  for(let z=0;z<h;z++) for(let x=0;x<w;x++)
    assert.equal(swap(g[z][x]), g[h-1-z][w-1-x],
      `arena ${ARENA} is not symmetric at ${x},${z}`);
});
