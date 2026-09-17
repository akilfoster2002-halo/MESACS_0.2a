/* THE SHIP'S PRE-FLIGHT — the vocabulary lesson, with no screen attached.

   Nine words and nine checks, one word to a check. Everything here that
   matters is a claim about a BOUNDARY: that `>` and `>=` come apart at
   exactly 20, that `<` and `<=` come apart at exactly 400, that a check
   which never tries the boundary cannot tell a student which of the two
   they picked. None of that can be seen by playing the mission — a wrong
   rule that happens to agree with the log on every reading looks exactly
   like a right one. So it is counted here instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../public/preflight.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Fill every blank of a check with one combination of words. */
const put = (base, slots, words) => {
  const s = { ...base };
  slots.forEach((sl,i)=>{ s[P.key(sl.check, sl.slot)] = words[i]; });
  return s;
};
/* Every combination of words a check's blanks could hold. */
function combos(check){
  const slots = P.slotsOf(check);
  const opts = slots.map(sl=>P.inKind(sl.kind));
  const out=[];
  (function rec(i, acc){
    if(i===slots.length){ out.push(acc.slice()); return; }
    for(const w of opts[i]){ acc.push(w); rec(i+1, acc); acc.pop(); }
  })(0, []);
  return { slots, out };
}
/* The one answer to a check — derived, never written down, so a test that
   uses it is testing the console rather than agreeing with itself. */
function solve(check){
  const { slots, out } = combos(check);
  const pass = out.filter(w => P.done(check.id, put({}, slots, w)));
  assert.strictEqual(pass.length, 1,
    `${check.id} has ${pass.length} right answers, not 1`);
  return put({}, slots, pass[0]);
}
const SOLVED = () => P.CHECKS.reduce((s,c)=>({ ...s, ...solve(c) }), {});

/* ------------------------------------------------------------- the words */
test('the vocabulary is nine words in three parts of speech', ()=>{
  assert.strictEqual(P.WORDS.length, 9);
  assert.deepStrictEqual(P.inKind('cmp'),  ['<','>','<=','>=','==','!=']);
  assert.deepStrictEqual(P.inKind('join'), ['and','or']);
  assert.deepStrictEqual(P.inKind('neg'),  ['not']);
  for(const w of P.WORDS){
    assert.ok(w.name && w.name.length > 3, w.id+' has no English name');
    assert.ok(w.help && w.help.length > 20, w.id+' has no explanation');
  }
  /* AND EVERY ONE OF THEM IS THE ANSWER TO SOMETHING. A word on the bank
     that no check ever wants is a word nobody is taught — it is decoration
     that makes the other eight harder to pick between. */
  const answers = new Set();
  for(const c of P.CHECKS) for(const v of Object.values(solve(c))) answers.add(v);
  for(const w of P.WORDS)
    assert.ok(answers.has(w.id), `nothing in the checklist needs ${w.id}`);
});

test('each check is led by a different word', ()=>{
  /* Nine checks, nine words, one apiece — so the mission is meeting each
     word once rather than filling in nine blanks. `word` is the claim the
     check makes about itself; this is the claim being checked. */
  const led = P.CHECKS.map(c=>c.word);
  assert.strictEqual(new Set(led).size, P.CHECKS.length, 'two checks lead on the same word');
  for(const c of P.CHECKS){
    const answer = Object.values(solve(c));
    assert.ok(answer.includes(c.word),
      `${c.id} says it is about ${c.word} and its answer is ${answer.join(' ')}`);
  }
});

/* ----------------------------------------------------------- the checks */
test('every check has exactly one right answer', ()=>{
  /* THE WHOLE POINT OF THE LOG. A rule tried on one reading proves nothing
     — `>` gets a tank with 34 in it right too. Put every word this console
     can express into every blank of a check and precisely one combination
     may survive its readings, or the panel cannot ring the blank that is
     wrong, because none of them is. */
  for(const c of P.CHECKS){
    const { slots, out } = combos(c);
    const pass = out.filter(w=>P.done(c.id, put({}, slots, w)));
    assert.strictEqual(pass.length, 1,
      `${c.id}: ${pass.length} of ${out.length} combinations pass — `
      + pass.map(w=>w.join(' ')).join(' | '));
  }
});

test('every check tries its own boundary, and the boundary is what decides it', ()=>{
  /* THE BUG THIS EXISTS TO STOP COMING BACK, and it is a silent one. Take
     20 out of the fuel log and `fuel > 20` passes every reading that is
     left — the check still works, still goes green, and has quietly
     stopped being able to tell "at least" from "more than", which is the
     only thing it was ever for.

     SO THE BOUNDARY READING HAS TO BE LOAD-BEARING: drop it, and a second
     answer gets in. That is a stronger claim than "the boundary is in the
     list" and it is the one that matters, because a boundary reading that
     changes no answer is decoration.

     The other readings are NOT required to be load-bearing. Fuel at 12
     rules out nothing that 34 has not already ruled out, and it earns its
     place another way: a log in which everything passes shows a student
     what success looks like and never what failure looks like. */
  const decides = (c, i) => {
    const { slots, out } = combos(c);
    const all = c.reads;
    c.reads = all.filter((_,j)=>j!==i);
    const pass = out.filter(w=>P.done(c.id, put({}, slots, w)));
    c.reads = all;
    return pass.length > 1;
  };
  for(const c of P.CHECKS){
    /* Something in every log has to be doing the work. */
    assert.ok(c.reads.some((_,i)=>decides(c,i)),
      `${c.id}'s log proves nothing: every reading can be dropped and the answer stays unique`);
    /* And both outcomes have to be in it, or nobody sees a HOLD. */
    assert.ok(c.reads.some(r=>r.pass),  `${c.id} has no reading that passes`);
    assert.ok(c.reads.some(r=>!r.pass), `${c.id} has no reading that fails`);
  }
  /* AND FOR THE FOUR THAT ASK "WHICH SIDE", the reading that decides has to
     be the one sitting exactly ON the number. `<` and `<=` agree about
     every other value there is and disagree only there, so that one line
     of the log is the entire difference between "below" and "at most". */
  for(const id of ['fuel','core','cargo','pad']){
    const c=P.checkOf(id);
    const at=c.reads.findIndex(r=>r[c.form.gauge]===c.form.rhs);
    assert.ok(at>=0, `${id} never tries ${c.form.gauge} at exactly ${c.form.rhs}`);
    assert.ok(decides(c, at),
      `${id} tries the boundary and it changes nothing — the check cannot tell `
      + 'the two words a student is most likely to confuse apart');
  }
  /* THE TWO THAT ASK "IS IT THIS ONE" ARE PINNED FROM BOTH SIDES INSTEAD.
     For `==` and `!=` the boundary reading is the one that PASSES, and what
     rules out `<=` and `>=` is having a reading below the number and
     another above it. One-sided, `key >= 1` survives the whole log. */
  for(const id of ['key','heading']){
    const c=P.checkOf(id), g=c.form.gauge, n=c.form.rhs;
    assert.ok(c.reads.some(r=>r[g] < n), `${id} never tries ${g} below ${n}`);
    assert.ok(c.reads.some(r=>r[g] > n), `${id} never tries ${g} above ${n}`);
    assert.ok(c.reads.some(r=>r[g] === n), `${id} never tries ${g} at ${n} itself`);
  }
});

test('the boundary readings are actually on the boundary', ()=>{
  /* Said a second way, and in the language a teacher would use: the
     comparison checks each have a reading sitting exactly on the number
     they compare against. That is where `<` and `<=` disagree and nowhere
     else, so it is the only reading that can tell them apart. */
  for(const id of ['fuel','core','cargo','pad','key']){
    const c=P.checkOf(id);
    const rhs=c.form.rhs, g=c.form.gauge;
    assert.ok(c.reads.some(r=>r[g]===rhs),
      `${id} never tries ${g} at exactly ${rhs}`);
  }
});

/* ---------------------------------------------------------- an empty slot */
test('an empty blank has no answer, which is not the same as a wrong one', ()=>{
  const c=P.checkOf('fuel');
  const rows=P.rowsOf('fuel', {});
  assert.ok(rows.every(r=>r.blank), 'an unfilled rule is being given an answer');
  assert.ok(rows.every(r=>r.got===null), 'an unfilled rule evaluates to something');
  assert.strictEqual(P.done('fuel', {}), false, 'an unfilled rule counts as finished');
  assert.strictEqual(P.begun('fuel', {}), false);
  /* And the console says so in those words rather than calling it wrong. */
  assert.match(P.run({}).why, /blank/i, 'an empty checklist is diagnosed as wrong instead of unfilled');
  assert.match(P.run({}).lines.map(l=>l.text).join('\n'), /nothing in the blank yet/);
});

test('a half-filled join is still unanswered', ()=>{
  /* `psi > 8 __ psi < 40` has two thirds of an answer and no value at all.
     Treating a missing join as `false` would mark the two comparisons
     wrong, and they are not wrong — they are not finished. */
  const c=P.checkOf('cabin');
  const s={ [P.key('cabin','lo')]:'>', [P.key('cabin','hi')]:'<' };
  assert.ok(P.rowsOf('cabin', s).every(r=>r.blank), 'a missing join was given a value');
});

/* -------------------------------------------------------- parts of speech */
test('a word is refused by what kind of word it is, and told why', ()=>{
  /* THE HALF OF THE VOCABULARY NOBODY WRITES DOWN. These nine are three
     different parts of speech; `and` is not a worse answer than `>=`
     between two numbers, it is the wrong kind of word. A console that just
     says no there has taught nothing. */
  assert.strictEqual(P.refuse('>=', 'cmp'), null, 'a comparison is refused by a comparison blank');
  assert.strictEqual(P.refuse('and','join'), null);
  assert.strictEqual(P.refuse('not','neg'), null);
  for(const [w,k] of [['and','cmp'], ['not','cmp'], ['<','join'], ['not','join'], ['<','neg']]){
    const msg=P.refuse(w,k);
    assert.ok(msg && msg.length > 30, `${w} in a ${k} blank is refused without a reason`);
    assert.ok(/compare|join|flip/i.test(msg),
      `the refusal for ${w} in a ${k} blank does not say what kind of word it is`);
  }
  /* And a state that somehow carried one is cleaned rather than obeyed,
     because the panel refuses it at the click and the two have to agree. */
  const junk = P.tidy({ [P.key('fuel','op')]:'and' });
  assert.strictEqual(junk[P.key('fuel','op')], undefined);
});

/* ------------------------------------------------------ the walkthrough */
test('the checklist is walked one blank at a time, and finishes', ()=>{
  const answer = SOLVED();
  let s = P.blank(), guard = 0;
  const seen = [];
  while(P.step(s) && guard++ < 60){
    const st = P.step(s);
    seen.push(st.id + ':' + st.hole);
    assert.ok(answer[st.hole] !== undefined,
      'the walkthrough rings a blank nothing can fill: '+st.hole);
    s = { ...s, [st.hole]: answer[st.hole] };
  }
  assert.strictEqual(P.step(s), null, 'the walkthrough never runs out');
  assert.strictEqual(seen.length, P.total(),
    `${seen.length} steps for ${P.total()} blanks`);
  assert.strictEqual(P.run(s).ok, true, 'a checklist with no steps left does not clear');
  /* IN THE ORDER THEY ARE PRINTED. A checklist that jumps about is not a
     checklist, and the panel scrolls to whichever row is open. */
  const order = seen.map(x=>x.split(':')[0]);
  assert.deepStrictEqual(order, [...new Set(order)].flatMap(
    id => order.filter(x=>x===id)), 'the walkthrough leaves a check and comes back to it');
});

test('the walkthrough is read off the board, not counted', ()=>{
  const answer = SOLVED();
  assert.strictEqual(P.step(answer), null, 'a finished board still has a step');
  /* Undo any one blank and its check is the step again, wherever it sits. */
  for(const id of ['fuel','heading','power','thrust']){
    const c=P.checkOf(id), sl=P.slotsOf(c)[0];
    const broke={ ...answer }; delete broke[P.key(sl.check, sl.slot)];
    assert.strictEqual(P.step(broke).id, id,
      'undoing a blank in '+id+' does not bring its check back');
  }
  /* And a wrong word, rather than a missing one, is still that check. */
  const wrong={ ...answer, [P.key('fuel','op')]:'>' };
  assert.strictEqual(P.step(wrong).id, 'fuel');
  assert.strictEqual(P.step(wrong).need, 'fix', 'a filled-but-wrong blank reads as unfilled');
});

test('no step ever hands over the symbol', ()=>{
  /* THE ENGLISH IS THE QUESTION AND THE SYMBOL IS THE ANSWER, so "at least
     20" and "above 8 and below 40" belong in the spec — translating them
     is the entire exercise, and a sentence that avoided saying "and" would
     be avoiding the thing being taught. What must never appear is the
     symbol: the moment a step says `>=` the log stops being read and the
     nine words stop being a vocabulary. */
  const answer = SOLVED();
  const SYMBOLS = P.inKind('cmp');
  for(const c of P.CHECKS){
    const one = Object.keys(solve(c))[0];
    const part = { ...answer }; delete part[one];
    const st = P.step(part);
    if(!st || st.id!==c.id) continue;
    const plain = st.say.replace(/<[^>]+>/g,'');
    for(const sym of SYMBOLS)
      assert.ok(!plain.includes(sym),
        `${c.id}'s step prints the symbol "${sym}": ${plain}`);
  }
  /* And the vocabulary line under it names the KIND of word wanted, never
     the word — "it wants something that compares them", not ">=". */
  const st = P.step({});
  assert.ok(st && st.kind, 'a step does not say what kind of blank it is');
});

/* -------------------------------------------------------------- the run */
test('a run says what every gauge did, and clears only when all nine do', ()=>{
  const answer = SOLVED();
  const r = P.run(answer);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.checks.length, 9);
  assert.ok(r.checks.every(c=>c.ok));
  assert.strictEqual(r.why, null);
  for(const l of r.lines)
    assert.ok(['rule','good','bad','idle'].includes(l.kind), 'unknown trace kind: '+l.kind);
  /* One wrong word anywhere holds the whole launch, and the diagnosis
     names the reading rather than the word. */
  const wrong={ ...answer, [P.key('cargo','op')]:'<' };
  const held=P.run(wrong);
  assert.strictEqual(held.ok, false);
  assert.match(held.why, /CARGO/);
  assert.match(held.why, /400/, 'the diagnosis does not say which reading came out wrong');
});

test('nothing a player can click breaks it', ()=>{
  for(const junk of [undefined, null, {}, { 'fuel.op':'purple' }, { 'nope.nope':'<' },
                     { 'cabin.join':'<' }]){
    const r=P.run(junk);
    assert.ok(Array.isArray(r.lines) && r.lines.length);
    assert.strictEqual(typeof r.ok, 'boolean');
    const st=P.step(junk);
    assert.ok(st===null || typeof st.say==='string');
  }
  assert.strictEqual(P.checkOf('nonsense'), null);
  assert.strictEqual(P.wordOf('nonsense'), null);
  assert.deepStrictEqual(P.rowsOf('nonsense', {}), []);
});

/* ------------------------------------------------------------ the console */
test('the panel draws the vocabulary and asks preflight.js everything', ()=>{
  const fix = read('public/shipfix.js');
  /* THE BANK IS THE LESSON. Nine chips built from WORDS, not typed out —
     a tenth word added to preflight.js has to appear on screen by itself,
     or the list a student reads and the list the console accepts are two
     lists. */
  assert.match(fix, /\b(?:R|P\(\))\.WORDS\.map/, 'the word bank is not drawn from WORDS');
  assert.match(fix, /\b(?:R|P\(\))\.run\(state\)/, 'the panel decides for itself whether it passed');
  assert.match(fix, /\b(?:R|P\(\))\.step\(state\)/, 'the panel picks its own next blank');
  assert.match(fix, /\b(?:R|P\(\))\.refuse\(/, 'the panel writes its own refusals');
  /* NO SECOND EVALUATOR. The whole point of preflight.js being DOM-free is
     that the thing under test is the thing that runs; a comparison table
     in the panel would be a second answer that no test ever sees. */
  assert.ok(!/const\s+CMP\b/.test(fix), 'shipfix.js keeps its own comparison table');
  assert.ok(!/\(a,\s*b\)\s*=>/.test(fix), 'shipfix.js compares two numbers itself');
  /* And closing it must not leave the world frozen: it sets G.running
     false on open, so every way out has to set it back. */
  assert.match(fix, /function close\(\)\{[\s\S]*?G\.running=true;/,
    'closing the panel leaves the world frozen');
});

test('the ship is on RYU, is what E opens, and the rover is gone', ()=>{
  const planet = read('public/planet.js');
  assert.match(planet, /enter:'ship'/, 'nothing on the planet opens the pre-flight');
  assert.match(planet, /const known = id==='ryuhouse' \|\| id==='ship'/,
    "use() does not know 'ship': E would do nothing");
  /* E DOES THREE THINGS NOW, in the order the mission needs them: the
     brief the first time, the checklist while she is shut, and climbing
     in once she is open. Sliced rather than matched with a window — the
     same argument embark() gets below: a regex with a character budget in
     it fails by counting, which says nothing about the code. */
  const ship = planet.slice(planet.indexOf("if(id==='ship'){"),
                            planet.indexOf("if(id==='library')"));
  assert.ok(ship, "use() has no branch for 'ship'");
  assert.match(ship, /openFix\(\);/, 'E at the ship does not open the checklist');
  assert.match(planet, /function openFix\(\)\{[\s\S]{0,200}SHIPFIX\.open\(/,
    'and nothing behind that name opens it either');
  assert.match(ship, /if\(shipOpen\(\) && board\(\)\) return;/,
    'E at a cleared ship re-opens a checklist with nine ticks on it');
  /* THE REASON BEFORE THE BLANKS. A checklist that arrives with no account
     of why it is being filled in is a worksheet, and the brief is the only
     thing that says what is wrong with her. It has to run FIRST, and it
     has to hand on to the panel rather than just ending. */
  assert.match(ship, /if\(!briefed\(\) && shipBrief\(openFix\)\) return;/,
    'the checklist opens with no brief in front of it, or the brief drops the player');
  /* And it is once: a scene you have watched is a scene in the way. */
  assert.match(planet, /const SEEN='ion_shipbrief'/,
    'the brief is not remembered, so it plays every single time E is pressed');
  assert.match(planet, /PROGRESS\.set\(SEEN,1\)/, 'nothing ever writes that flag');
  /* GETTING IN IS THE START OF THE FLIGHT, and arriving at the tower is
     what finishes the mission. Boarding used to end it on the spot, which
     made the E-45 a cutscene with a checklist in front of it. */
  assert.match(planet, /end:\(\)=>\{ G\.running=true; embark\(\); \}/,
    'the boarding scene does not hand over to the flight');
  /* Sliced rather than matched with a window: embark() is a long function
     and a regex with a character budget in it fails by counting, which
     says nothing about the code. */
  const embark = planet.slice(planet.indexOf('function embark()'),
                              planet.indexOf('function disembark()'));
  assert.ok(embark, 'there is no embark()');
  assert.match(embark, /takeOff\(\);/, 'climbing in does not take off');
  assert.match(embark, /AVATAR\.detach\(\)/, 'Robin is left standing beside the ship she is flying');
  assert.match(embark, /shipB\.solids\.length=0/,
    'the parked ship keeps its collision box: she takes off through her own hull');
  const arrive = planet.slice(planet.indexOf('function arriveTick()'),
                              planet.indexOf('function padSpec('));
  assert.match(arrive, /AVATAR\.attach\(\)/, 'she arrives still invisible, inside a ship that is gone');
  /* ARRIVING IS NOT FINISHING. Landing used to call complete('ion'), which
     ended Mission 8 outside the building — Ion asked for somebody who
     could look inside him properly and the mission paid off before anybody
     had. It ends at the cradle now.

     CODE ONLY, NOT COMMENTS. The first version of this check matched the
     whole slice, and the paragraph explaining the move contains the very
     string it was looking for — so it went on passing after the call it
     was guarding had gone. Strip the comments before asserting about what
     the code does. */
  const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.ok(!/PROGRESS\.complete\(/.test(bare(arrive)),
    'landing at the tower still finishes the mission on the tarmac');
  const hand = planet.slice(planet.indexOf('function handOver()'),
                            planet.indexOf('function layIon()'));
  assert.ok(hand, 'there is no handover');
  assert.match(bare(hand), /PROGRESS\.complete\('ion'\)/,
    'handing Ion to the Mechanic does not finish Mission 8');
  assert.match(bare(hand), /PROGRESS\.set\(HANDED,1\)/, 'the handover is not remembered');
  assert.match(planet, /aboard=false; shipRide=null; arrived=false;/,
    'leaving the world leaves her aboard a ship that no longer exists');
  /* AND THE PROMPT CHANGES WITH THE CANOPY, or it tells you to inspect a
     ship that is standing open waiting for you. */
  assert.match(planet, /verb = shipOpen\(\) \? 'E \\u2014 get in' : null/,
    'the prompt never stops saying inspect');
  assert.match(read('public/game.js'), /u\.verb \? t\(u\.verb\)/,
    'game.js ignores a prop that names its own verb');
  /* BOTH HALVES OF HER, and both with the version on. Models are served
     with max-age=86400; one fetched without ?v= is yesterday's copy for a
     day, and a canopy a day out of step with its hull is a hole. */
  for(const f of ['e45-hull','e45-canopy'])
    assert.ok(new RegExp("ships/"+f+"\\.glb\\?v=' *\\+ *\\(window\\.ASSETV").test(planet),
      f+'.glb is fetched without ?v=ASSETV, or not at all');
  for(const f of ['public/ships/e45-hull.glb','public/ships/e45-canopy.glb'])
    assert.ok(fs.existsSync(path.join(__dirname,'..',f)), f+' is not installed');

  /* THE CANOPY IS A DOOR, so it is hinged rather than welded: its own
     file, its own group, and one axis to turn about. */
  assert.match(planet, /const HINGE = \{/, 'the canopy has no hinge');
  assert.match(planet, /hinge\.rotation\.x/, 'nothing ever turns it');
  assert.match(planet, /canopyOpen\(\);/, 'clearing the pre-flight does not open her up');
  assert.match(planet, /canopyTick\(dt\)/, 'nothing drives the canopy: it would snap open');
  assert.match(planet, /shipOpen\(\) \? CANOPY_OPEN : 0/,
    'a ship cleared yesterday is shut again this morning');
  /* THE ROVER IS RETIRED, and its lesson with it. A file left on the page
     that nothing routes is a second vehicle mission nobody can reach. */
  for(const f of ['public/rover.js','public/garage.js'])
    assert.ok(!fs.existsSync(path.join(__dirname,'..',f)), f+' is still here');
  const html = read('public/index.html');
  assert.ok(!/rover\.js|garage\.js/.test(html), 'index.html still loads the rover');
  for(const f of ['preflight.js','shipfix.js'])
    assert.match(html, new RegExp(`<script src="${f}\\?v=\\d+"></script>`), f+' is not on the page');
});

test('the model is installed, in two halves, and carries its own colour', ()=>{
  /* TWO FILES, CUT ALONG THE AUTHOR'S OWN MATERIAL LINE. A canopy welded
     to the hull cannot open, and a third file with the whole ship in it
     would be a third copy of the same mesh to keep in step. */
  let tris = 0;
  for (const f of ['e45-hull.glb', 'e45-canopy.glb']) {
    const file = path.join(__dirname, '..', 'public/ships', f);
    assert.ok(fs.existsSync(file), f + ' is not installed');
    const b = fs.readFileSync(file);
    const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    const prim = json.meshes[0].primitives[0];
    assert.ok(prim.attributes.COLOR_0,
      f + ' has no vertex colours — nothing in this game ships a texture, so it would render white');
    tris += json.accessors[prim.indices].count / 3;
  }
  /* And together they are the whole aeroplane and not a bit of it. */
  assert.strictEqual(tris, 16220,
    'the two halves do not add up to the model they were cut from');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'public/ships/e45.glb')),
    'the undivided ship is still installed: a third copy of the same mesh');
  /* AND THE CANOPY CAME FROM THE FILE, not from a band. obj2glb carries the
     author's `usemtl` runs through; without them the painter guesses the
     canopy from a bounding box and puts it on the tail fin. */
  assert.ok(read('glb files/obj2glb.js').includes('extras:{groups:GROUPS}'),
    'obj2glb no longer carries the material runs through');
  assert.match(read('glb files/paint-ship.js'), /B\.parts \|\| \{\}/,
    'paint-ship no longer reads them');
});

test('the panel asks one question at a time, in as few words as it can', ()=>{
  /* IT USED TO BE A COCKPIT. Nine rules down the left, a running trace
     down the right, a step card, a vocabulary line, a refusal line and a
     fourteen-blank counter — all on screen while a nine-year-old decided
     between `<` and `<=`. Every piece was defensible alone and together
     they were somewhere to get lost. */
  const fix = read('public/shipfix.js');

  /* ONE CHECK ON SCREEN, chosen by an index rather than by drawing them
     all and highlighting one. */
  assert.match(fix, /const check = \(\) => P\(\)\.CHECKS\[at\]/,
    'the panel no longer draws a single check at a time');
  assert.ok(!/CHECKS\.map\(c=>\{/.test(fix), 'the whole checklist is being drawn again');
  /* And the trace column is gone: the readings under the question are the
     feedback, so a second running commentary is a second thing to read. */
  assert.ok(!/sftrace|What the gauges did/.test(fix),
    'the panel still carries a trace column beside the question');

  /* FORWARD IS EARNED, and it is the only way on. */
  assert.match(fix, /function forward\(\)\{[\s\S]{0,200}?if\(!R\.done\(check\(\)\.id, state\)\) return;/,
    'the NEXT button does not check that the question was answered');
  assert.match(fix, /at < R\.CHECKS\.length-1/, 'nothing advances to the next check');
  assert.match(fix, /R\.run\(state\)/, 'the last step does not run the whole pre-flight');

  /* PROGRESS WITHOUT WORDS. */
  assert.match(fix, /sfdot/, 'there is no wordless progress indicator');
  /* The CODE, not the commentary — the paragraph above the dots names the
     phrase they replaced in order to say what they replaced. */
  const code = fix.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/filled in/.test(code), 'the panel still counts blanks at the player in words');
  assert.ok(!/RUN PRE-FLIGHT/.test(code), 'there is still a separate run step to find');
});

test('nothing a student reads is longer than a breath', ()=>{
  /* THE WHOLE POINT OF THE REDESIGN, counted rather than admired. Every
     sentence the panel shows comes from preflight.js, so it can be
     measured here — and if one of them grows, this is what says so. */
  const words = t => t.replace(/<[^>]+>/g,'').trim().split(/\s+/).length;

  for(const c of P.CHECKS){
    assert.ok(words(c.says) <= 10,
      `${c.id}'s rule is ${words(c.says)} words: "${c.says.replace(/<[^>]+>/g,'')}"`);
    assert.ok(c.name.length <= 12, `${c.id}'s heading is too long: ${c.name}`);
  }
  /* A chip is a symbol and a label short enough to sit under it. */
  for(const w of P.WORDS)
    assert.ok(words(w.name) <= 3, `the label for ${w.id} is ${words(w.name)} words: ${w.name}`);

  /* The step says the rule and nothing else — it used to append the
     failing reading in twenty words, describing a row of a table the
     student is already looking at, which is already red. */
  const st = P.step({});
  assert.strictEqual(st.say, P.checkOf(st.id).says,
    'the step has started explaining the table instead of showing it');
  /* And the one nudge, when every blank is full and it still does not
     match, is a short one. */
  const answer = SOLVED();
  const wrong = { ...answer, [P.key('cargo','op')]:'<' };
  const miss = P.step(wrong).miss;
  assert.ok(miss && words(miss) <= 9, 'the nudge is a paragraph: '+miss);

  /* Refusals too: one line about what kind of word it is. */
  for(const [w,k] of [['and','cmp'], ['<','join'], ['>=','neg']])
    assert.ok(words(P.refuse(w,k)) <= 14, `the refusal for ${w} in a ${k} blank is too long`);
});

test('the tower is further, and still on the horizon', ()=>{
  /* A THING YOU CAN SEE AND CANNOT REACH IS THE MISSION. Move the tower out
     without growing it and it drops below the curve — the gap is still
     there and the reason to cross it is not. At a radius of 240 the
     horizon from head height is about 28 units and a thing H tall is seen
     from 28 + sqrt(2*240*H). */
  const planet = read('public/planet.js');
  /* To the end of the record, not to the first close brace — the emoji is
     written \u{1F5FC} and that brace comes first. */
  const tAt = planet.indexOf("{ id:'tower'");
  const tower = planet.slice(tAt, planet.indexOf('}', planet.indexOf('blurb:', tAt)) + 1);
  const lon = +tower.match(/lon:(-?\d+)/)[1];
  const lat = +tower.match(/lat:(-?\d+)/)[1];
  const h   = +tower.match(/h:(\d+)/)[1];
  const hAt = planet.indexOf("{ id:'ryuhouse'");
  const house = planet.slice(hAt, planet.indexOf('}', planet.indexOf('blurb:', hAt)) + 1);
  const hlon = +house.match(/lon:(-?\d+)/)[1], hlat = +house.match(/lat:(-?\d+)/)[1];

  const PR = 240;
  const away = Math.hypot(lon - hlon, lat - hlat) * Math.PI / 180 * PR;
  const seen = 28 + Math.sqrt(2 * PR * h);

  assert.ok(away > 160, `the tower is only ${away.toFixed(0)} units out — that is a walk`);
  assert.ok(seen > away,
    `a ${h}-high tower is visible from ${seen.toFixed(0)} and stands at ${away.toFixed(0)}: `
    + 'it is below the curve, so nobody can see the thing they are being sent to');
});

test('a mission world lends you neither a car nor a jetpack', ()=>{
  /* Robin's car and Robin's jetpack are things she owns on her own worlds.
     Inside a story they are two ways to be somewhere the story did not put
     you — over the tower before there is a reason to go, or across the
     gap in a vehicle the mission is not about. The E-45 is how you travel
     here and she has to be earned. */
  const planet = read('public/planet.js');
  assert.match(planet, /const wayOpen = id => id==='foot' \|\| !\(W && W\.mission\);/,
    'nothing decides which ways to travel a world allows');
  /* The menu greys them, and the two functions behind it refuse as well —
     a menu is a picture of a rule, not the rule. */
  assert.match(planet, /const open = wayOpen\(w\.id\) &&/, 'the travel menu offers them anyway');
  assert.match(planet, /function toggleRide\(\)\{[\s\S]{0,200}?if\(!wayOpen\('car'\)\)/,
    'a car can still be summoned on a mission world');
  assert.match(planet, /function takeOff\(\)\{[\s\S]{0,400}?if\(!aboard && !wayOpen\('fly'\)\)/,
    'the jetpack still works on a mission world');
  /* And the one flight that IS the mission goes through the same door. */
  assert.match(planet, /!aboard &&/, 'the ship cannot take off either, which is the whole mission');
});

/* =====================================================================
   THE SMOKE, THE BRIEF AND THE WALKTHROUGH — the three things that turn
   a panel with fourteen blanks in it into a mission somebody can start
   on their own.

   ALL THREE FAIL SILENTLY AND IDENTICALLY. Smoke that is never ticked is
   a ship that looks fine; a brief that never fires is a checklist with no
   reason attached; a tour whose steps are never drawn is a panel that
   looks exactly like the panel did before. Nothing throws and nothing
   logs, and the only symptom is a nine-year-old who does not know that
   the ship on the hillside is the mission.
   ===================================================================== */

test('the boundary is what the console volunteers, and only the boundary', ()=>{
  /* THE ONE MISTAKE WORTH A SENTENCE. `>` and `>=` agree about every
     number in the world except 20, and FUEL puts 20 in its log on
     purpose — so a rule that is wrong at exactly 20 is a rule whose
     author has not met the idea of a boundary yet, and that is worth
     saying out loud once. Every other kind of wrong is not. */
  const at = w => ({ [P.key('fuel','op')]: w });

  /* `>` at the boundary: her rule stops a ship with exactly 20 in it. */
  const tight = P.edge('fuel', at('>'));
  assert.ok(tight, '> at 20 is the mistake this is for, and it says nothing');
  assert.strictEqual(tight.gauge, 'fuel');
  assert.strictEqual(tight.value, 20, 'it points at a reading that is not the edge');
  assert.match(tight.say, /stops her/, 'a rule that is too tight is not described as too tight');

  /* CARGO IS THE MIRROR, and the same mistake: `<` shuts out a load of
     exactly 400, which the log says is fine. One word out, one row red,
     and it is the row the whole check was built around. */
  const cargo = P.edge('cargo', { [P.key('cargo','op')]: '<' });
  assert.ok(cargo, '< at 400 is the same mistake, and cargo says nothing about it');
  assert.strictEqual(cargo.value, 400, 'it points at a reading that is not the edge');
  assert.match(cargo.say, /stops her/, 'a rule that is too tight is not described as too tight');
  /* AND THE OTHER DIRECTION READS DIFFERENTLY. A rule that is too LOOSE
     is clearing a ship that should be held, which is not the same mistake
     and must not be the same sentence. PAD at exactly freezing: `>=`
     clears a pad the log holds. */
  const loose = P.edge('pad', { [P.key('pad','op')]: '>=' });
  assert.ok(loose, 'the pad has a boundary too');
  assert.strictEqual(loose.value, 0);
  assert.match(loose.say, /clears her/,
    'a rule that is too loose is described as if it were too tight');

  /* NOT WHEN THEY ARE RIGHT. The right answer must never be nudged, or
     the sentence means nothing. */
  assert.strictEqual(P.edge('fuel', at('>=')), null,
    'the correct rule is told to look at the line it already got right');
  /* NOT WHILE IT IS EMPTY. An unanswered check is not a wrong one. */
  assert.strictEqual(P.edge('fuel', {}), null, 'a blank rule is nudged about a mistake');
  /* NOT WHEN THE EDGE IS FINE AND SOMETHING ELSE BROKE. `<` on FUEL is
     wrong everywhere, including 20 — but `==` is wrong at 34 and 12 and
     RIGHT at 20, so there is nothing about the boundary to say. */
  assert.strictEqual(P.edge('fuel', at('==')), null,
    'a rule that got the boundary right is lectured about the boundary');
  /* AND NEVER ON A JOINED RULE, which has two thresholds and therefore no
     single edge to point at. */
  for(const id of ['cabin','power'])
    assert.strictEqual(P.edge(id, P.blank()), null, id+' claims to have one boundary');
});

test('the walkthrough is six steps, and every one points somewhere real', ()=>{
  assert.ok(Array.isArray(P.TOUR) && P.TOUR.length >= 4,
    'there is no walkthrough to run');
  /* EVERY STEP NAMES A BOX THE PANEL ACTUALLY DRAWS. A step pointing at a
     region shipfix.js has no branch for is a step that lights nothing up
     and reads as a sentence about the wrong thing. */
  const fix = read('public/shipfix.js');
  for(const s of P.TOUR){
    assert.ok(s.say && s.at, 'a tour step with nothing to say or nothing to point at');
    assert.ok(/^[a-z]+$/.test(s.at), 'a region name that is a selector');
    assert.ok(fix.includes(`'${s.at}'`),
      `the tour points at ${s.at} and shipfix.js has no such region`);
    /* THE SAME NINE-WORD BUDGET THE REST OF THE FILE IS WRITTEN TO. A
       walkthrough is read by somebody who is already lost; a step that
       needs reading twice is worse than no step. */
    assert.ok(s.say.split(/\s+/).length <= 9,
      `"${s.say}" is longer than the panel's own sentences`);
  }
  /* AND IT ENDS AT THE THING IT IS FOR, which is a click on a word. */
  assert.match(P.TOUR[P.TOUR.length-1].say, /[Cc]lick/,
    'the tour never says what to press');
});

test('the panel draws the walkthrough from TOUR, and gets out of the way', ()=>{
  const fix = read('public/shipfix.js');
  /* NOT TYPED OUT. A seventh step added to preflight.js has to appear on
     screen by itself, the same argument the word bank is built on. */
  assert.match(fix, /P\(\)\.TOUR/, 'the tour is not drawn from TOUR');
  assert.match(fix, /P\(\)\.edge\(/, 'the panel decides for itself where a boundary is');
  /* IT STARTS WHEN THE CONSOLE DOES. */
  assert.match(fix, /tour=0;/, 'the tour never starts');
  /* AND PLACING A WORD ENDS IT. Somebody who has worked out what to press
     has finished with a walkthrough about what to press. */
  const place = fix.slice(fix.indexOf('function place('), fix.indexOf('function forward('));
  assert.match(place, /tour=-1;/, 'the tour talks over a student who is already playing');
  /* ONE BUBBLE AT A TIME. The tour and the boundary line are the same box
     in the same place; a panel that can show both shows two things to
     read where it promised one. */
  assert.match(fix, /const eg = tp \? null : nudge\(c\)/,
    'the tour and the boundary line can be on screen together');
});

test('the E-45 smokes until she is mended, and stops because she is mended', ()=>{
  const planet = read('public/planet.js');
  /* THE PUFFS EXIST, ARE BUILT WITH HER, AND ARE DRIVEN. Any one of the
     three missing is a ship that never smokes and says nothing about it. */
  assert.match(planet, /function smokeBuild\(/, 'nothing builds the smoke');
  assert.match(planet, /smokeBuild\(spin, SHIP_LEN\)/,
    'the smoke is never built, or is built somewhere it cannot follow her');
  assert.match(planet, /smokeTick\(dt\);/, 'nothing drives the smoke: it would hang still');
  /* TIED TO THE PRE-FLIGHT, not to a timer and not to the canopy. The
     clear is the moment something was actually mended. */
  const tick = planet.slice(planet.indexOf('function smokeTick('),
                            planet.indexOf('function shipVerb('));
  assert.ok(tick, 'there is no smokeTick()');
  assert.match(tick, /shipOpen\(\)/,
    'the smoke does not ask whether she has been cleared, so it never stops');
  /* AND IT FADES. Smoke that is gone between two frames was a sprite
     being switched off, which is not a thing anybody reads as mending. */
  assert.match(planet, /SMOKE_FADE/, 'the smoke vanishes in one frame');
  /* IT GOES WITH THE WORLD THAT HELD IT. The puffs hang off a group that
     is thrown away when you leave; a module-level handle to it kept
     across worlds is a tick writing into a scene that is gone. */
  assert.match(planet, /shipB=null; smoke=null;/,
    'the puffs outlive the ship they were hung on');
});

test('the brief says what is broken, and it is the checklist that is broken', ()=>{
  const planet = read('public/planet.js');
  const brief = planet.slice(planet.indexOf('function shipBrief('),
                             planet.indexOf('function board()'));
  assert.ok(brief, 'there is no brief');
  assert.match(brief, /SCENE\.play\(/, 'the brief is not a scene');
  /* BOTH OF THEM ARE IN IT. The player asks and Ion answers: a brief where
     one person explains the mission to nobody is a briefing screen with a
     portrait on it.

     `who:'you'` IS THE PLAYER, BY NAME. It used to say `who:'Robin'`,
     because RYU turned everybody into her; the bar now reads whatever
     name the player signed in with, and SCENE is the only thing that
     knows how to resolve that. */
  for(const who of ['you','Ion'])
    assert.ok(brief.includes(`who:'${who}'`), who+' says nothing in the brief');
  assert.ok(!/who:'Robin'/.test(brief), "the brief still calls the player Robin");
  /* WHAT IS WRONG WITH HER IS HER RULES. If the ship is damaged then
     filling in nine comparisons is a strange way to mend it, and the
     mission is nonsense dressed as a lesson. */
  assert.match(brief, /safety rules/i,
    'the brief never says what is actually broken, so the panel is a non sequitur');
  assert.match(brief, /smoking/i, 'the brief never mentions the smoke it opens on');
  /* AND IT HANDS ON. A scene that ends without calling anything leaves
     the player standing at a ship having watched a cutscene about it. */
  assert.match(brief, /if\(then\) then\(\);/, 'the brief ends and nothing happens');
  assert.match(brief, /G\.running=true;/, 'the brief ends with the world still frozen');
});

test('every flag Mission 8 writes is forgotten when you start it over', ()=>{
  /* PROGRESS.restart(id) deletes the keys beginning with `id + '_'`, and
     Mission 8's id is `ion` (arriveTick calls PROGRESS.complete('ion')).
     That prefix is the whole mechanism — a flag filed anywhere else
     survives a restart silently.

     THIS HAS ALREADY HAPPENED ONCE. The ship's cleared state was called
     `ship_cleared`, so "start over" left it set: the canopy was drawn
     already open, the smoke never appeared, and E went straight to the
     boarding cutscene past the checklist the student had just asked to
     do again. The brief's flag WAS under `ion_` and was forgotten, so the
     two halves of one mission disagreed about whether it had happened.

     Read off the source rather than listed here, so a tenth flag added
     next year is caught without anybody remembering to add it. */
  const src = read('public/planet.js') + read('public/house.js');

  /* Every save key written as a bare string literal, plus the ones written
     through a const — both forms are in use and only checking one of them
     is how the last of these got in. */
  const keys = new Set();
  for(const m of src.matchAll(/PROGRESS\.set\(\s*'([a-z0-9_]+)'/g)) keys.add(m[1]);
  for(const m of src.matchAll(/const\s+[A-Z][A-Z_]*\s*=\s*'([a-z0-9_]+)'\s*;/g)) keys.add(m[1]);

  /* The keys that belong to the PLAYER rather than to this mission, and
     must NOT be forgotten by a restart: where they are standing, which
     planet they are on, their world seed, and the things they own. A
     restart replays a story; it does not repossess a ship. */
  const theirs = new Set(['home_seed','world','has_ship']);

  /* Anything to do with the E-45, the house or Ion is mission state. */
  const mission = [...keys].filter(k=>!theirs.has(k) && !/^at_|^spot_|^quiz_/.test(k))
                           .filter(k=>/ship|ion|canopy|preflight|brief|fixed|cleared/.test(k));
  assert.ok(mission.length >= 3, 'no mission flags found — the patterns above have gone stale');
  for(const k of mission)
    assert.ok(k.startsWith('ion_'),
      `'${k}' is mission state but is not under the 'ion_' prefix, so `
      + 'PROGRESS.restart("ion") will not forget it and "start over" will '
      + 'skip the part of Mission 8 it guards');
});

/* =====================================================================
   THE TOWER — three floors, a lift, and the room Mission 8 ends in.

   It was fifty-eight units of hollow shell with windows. You flew two
   hundred units to reach it, landed, and the mission ended outside it.
   ===================================================================== */

test('the tower has floors, and the floors are where the windows are', ()=>{
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  assert.match(bare, /function towerRoom\(/, 'the tower has no interior');
  assert.match(bare, /b\.id==='tower'[\s\S]{0,80}towerRoom\(/,
    'nothing routes the tower to its interior, so it is a shell again');

  /* THE FLOORS ARE DERIVED, NOT TYPED. dress() puts this building's rows
     of windows at fixed fractions of its height; a deck typed in by hand
     lands across the glass and seals the storey into a blue box, which is
     what 19 and 40 did. The stops have to be read off the same formula
     the walls are built from. */
  assert.match(bare, /function towerStopsFor\(b\)/, 'the floor heights are hard-coded again');
  assert.ok(!/\{ y:19,|\{ y:40,/.test(bare), 'a floor height is typed in rather than derived');

  /* And the derivation has to agree with the wall builder. Both numbers
     are read out of the source rather than restated here, so a change to
     either side fails this instead of quietly misaligning a storey. */
  const dressRows = planet.match(/const rows = H>14 \? 2 : 1;/);
  assert.ok(dressRows, 'dress() no longer decides rows the way towerStopsFor assumes');
  const stops = planet.slice(planet.indexOf('function towerStopsFor'),
                             planet.indexOf('let TOWER_STOPS'));
  assert.match(stops, /H>14 \? 2 : 1/, 'towerStopsFor has drifted from dress()');
  assert.match(stops, /0\.30 \+ r\*0\.34/, 'towerStopsFor no longer uses the window rows');

  /* A DECK UNDER EVERY WINDOW ROW, at the heights the tower actually is.
     Computed here the way the source says to, so this is a check on the
     arithmetic landing inside the glass rather than a copy of the answer. */
  const H=58, rows=2, winH=Math.min(3.0,(H-3)/(rows+0.7));
  for(let r=0;r<rows;r++){
    const centre=H*(0.30+r*0.34), deck=Math.round((centre-winH/2-0.2)*10)/10;
    assert.ok(deck > centre-winH/2-0.6 && deck < centre-winH/2+0.1,
      `floor ${r} at ${deck} does not sit just under the window at ${centre}`);
    assert.ok(deck+2.2 < centre+winH/2,
      `floor ${r} puts standing eye height above the top of its own window`);
  }
});

test('the lift is a deck that moves, and cannot stop between floors', ()=>{
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  /* THE WHOLE LIFT. floorAt() reads a deck's height every frame and a
     grounded walker is pinned to whatever it returns, so a slab whose y
     changes carries whoever is on it. If floorAt stops consulting decks,
     the lift becomes a platform that slides out from under you. */
  assert.match(bare, /if\(alt!==undefined && b\.decks\)/,
    'floorAt no longer asks about interior floors: the lift would leave you behind');
  assert.match(bare, /L\.deck\.y=y;/, 'the lift moves its picture but not its floor');
  assert.match(bare, /function liftTick\(/, 'nothing drives the lift');
  assert.match(bare, /liftTick\(dt\);/, 'liftTick is never called, so the lift never moves');

  /* ONE BUTTON, AND IT WRAPS. No floor list, no way to be stuck: press it
     again and you are somewhere. */
  const go = planet.slice(planet.indexOf('function liftGo()'),
                          planet.indexOf('const LIFT_FOR'));
  assert.match(go, /% TOWER_STOPS\.length/, 'the lift does not wrap: the top is a dead end');
  assert.match(go, /if\(lift\.t<1\)/,
    'the lift can be re-called mid-travel, which drops you through a floor that has moved');

  /* AND ITS CONSOLE LEAVES NO SOLID BEHIND. panel() pushes a collision box
     the size of the console; here that box would stand in the square metre
     you have to occupy to press it, and would stay at ground level while
     the console rode away up the shaft. */
  const room = planet.slice(planet.indexOf('function towerRoom('),
                            planet.indexOf('function liftFace('));
  assert.match(room, /b\.solids\.pop\(\);/,
    "the lift console's collision box is left in the shaft");
});

test('the Mechanic is a person, in the tower, and finishing there is Mission 8', ()=>{
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  /* A PERSON, NOT A SHOP. The Mechanic on Senio sells cars off plinths;
     the one Ion asked for is somebody who can look inside him. */
  assert.match(bare, /function workshop\(/, 'there is no workshop');
  assert.match(bare, /person\(g, b, [^)]*'THE MECHANIC'[^)]*\)|THE MECHANIC/,
    'nobody is standing in the workshop');
  assert.match(bare, /'towermech'/, 'the Mechanic cannot be spoken to');
  assert.match(bare, /id==='towermech'/, "use() does not know 'towermech': E would do nothing");

  /* CONTAINED IN MISSION 8. The point of moving the Mechanic here is that
     the mission no longer sends the player to another planet to end it, so
     the handover must be what completes it. */
  const hand = planet.slice(planet.indexOf('function handOver()'),
                            planet.indexOf('function layIon()'));
  assert.match(bare.slice(bare.indexOf('function handOver()')).slice(0,1400),
    /SCENE\.play\(/, 'the handover is not a scene');
  for(const who of ['you','Ion','The Mechanic'])
    assert.ok(hand.includes(`who:'${who}'`), who+' says nothing at the handover');
  assert.ok(!/who:'Robin'/.test(hand), 'the handover still calls the player Robin');

  /* AND HE IS VISIBLY THERE AFTERWARDS. A handover you are told about and
     cannot see did not happen. */
  assert.match(bare, /function layIon\(/, 'Ion is never put on the cradle');
  const lay = planet.slice(planet.indexOf('function layIon()'),
                           planet.indexOf('function einstein()'));
  /* LYING ON HIS BACK IS THREE AXES AT ONCE. A model stands up its own
     +Y, faces its own +Z and holds its arms along its own X, and putting
     it on a table has to send all three somewhere: head along the bench,
     face at the ceiling, arms across it.

     The first version turned him about one axis and then spun the model
     inside its wrapper to tidy the arms up — two of the three, which from
     most angles looks like a fix and leaves his spine across the bench
     with half of him over the edge. One Euler, applied Z then X. */
  assert.match(lay, /body\.rotation\.set\(-Math\.PI\/2, 0, -Math\.PI\/2\)/,
    'Ion is not laid on his back along the bench');
  assert.ok(!/root\.rotation/.test(lay),
    'the model is spun inside its wrapper again — one Euler does all three axes');
  /* AND HE RESTS ON THE TOP RATHER THAN IN IT. The cradle slab is centred
     at y+1.0 and is 0.4 thick, so its surface is y+1.2; a body on its
     back is about 0.4 through the chest. */
  const bed = planet.match(/bed:\{x:(-?[\d.]+), y:y\+([\d.]+), z:(-?[\d.]+)\}/);
  assert.ok(bed, 'the cradle position has been renamed');
  assert.ok(+bed[2] > 1.2 && +bed[2] < 1.6,
    `Ion's origin is y+${bed[2]}, which puts him through the cradle top at y+1.2 or floating over it`);
});

test('the lift can never outrun the floor it is carrying you on', ()=>{
  /* THE ONE THING THAT MAKES A MOVING DECK WORK. floorAt() hands a
     grounded walker the deck's height every frame, but only while they
     are within DECK_GRIP of it. If the deck climbs further than that
     between two frames it steps out from under its rider and carries on
     up empty — and because it only happens on a frame that HITCHES, it
     works every time anybody tries it by hand.

     game.js clamps dt, eased travel peaks at 1.5x its average, so the
     whole safety property is: peak speed x longest frame < grip. All
     four numbers are read out of the source, so moving a floor, changing
     the clamp or speeding the lift up fails this instead of producing a
     lift that occasionally leaves somebody behind. */
  const planet = read('public/planet.js');
  const game   = read('public/game.js');

  const grip  = +planet.match(/const DECK_GRIP=([\d.]+);/)[1];
  const speed = +planet.match(/const LIFT_SPEED = (\d+);/)[1];
  const minFor= +planet.match(/const LIFT_MIN\s+= ([\d.]+);/)[1];
  const dtMax = +game.match(/const dt=Math\.min\(\(now-last\)\/1000, ([\d.]+)\);/)[1];
  assert.ok(grip && speed && minFor && dtMax, 'one of the four numbers has been renamed');

  /* Every hop this lift can be asked to make, including the wrap from the
     top back to the ground, which is the longest and the one nobody
     tests by hand. */
  const H=58, rows=2, winH=Math.min(3.0,(H-3)/(rows+0.7));
  const stops=[0];
  for(let r=0;r<rows;r++) stops.push(Math.round((H*(0.30+r*0.34)-winH/2-0.2)*10)/10);
  for(let i=0;i<stops.length;i++){
    const far=Math.abs(stops[(i+1)%stops.length]-stops[i]);
    if(!far) continue;
    const secs=Math.max(minFor, far/speed);
    const step=(far*1.5/secs)*dtMax;         // the worst single frame
    assert.ok(step < grip,
      `a ${far}-unit ride moves ${step.toFixed(2)} on a ${dtMax}s frame, `
      + `past the ${grip} grip — the lift would leave its rider on the floor below`);
  }
});

test('a floor high up agrees with the walls around it', ()=>{
  /* THE SUBTLEST THING IN THE TOWER, and it is a fact about spheres.

     A building is a flat box laid tangent to the ball, and a player is a
     direction plus an altitude. Going straight UP from a spot off the
     middle of a room carries you OUTWARD in that box's own axes: at 35
     units up on a radius of 240, a spot 6 metres from the centre is 6.9
     from it.

     blocked() measures a player against walls at their own radius;
     floorAt() measured them against floors at GROUND radius. So the two
     disagreed by over a metre at the top of the tower. It showed up as a
     lift that carried you up perfectly and then would not let you off:
     the rider had drifted into the back wall on the way, was overlapping
     a solid, and could not walk in any direction at all.

     Both must read the same frame, and the shaft must sit far enough
     inboard that the drift never puts a rider inside a wall. */
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  assert.match(bare, /const la=local\(b, dir\.clone\(\)\.multiplyScalar\(PR\+alt\)\);/,
    'floorAt measures decks at ground radius again, so floors and walls disagree high up');
  assert.match(bare, /if\(la\.x < d\.x1 \|\| la\.x > d\.x2 \|\| la\.z < d\.z1 \|\| la\.z > d\.z2\)/,
    'the deck footprint test does not use the at-altitude position');

  /* AND THE SHAFT IS INBOARD ENOUGH TO SURVIVE THE DRIFT. Read the real
     numbers out of the source: the shaft, the tower's depth, and the wall
     thickness dress() builds, so moving any of them fails here rather
     than stranding somebody at the top. */
  const sh = planet.match(/const SHAFT = \{ x1:(-?[\d.]+), x2:(-?[\d.]+), z1:(-?[\d.]+), z2:(-?[\d.]+) \}/);
  assert.ok(sh, 'the shaft has been renamed');
  const z1=+sh[3];
  const H=58, D=16, PRad=240;                 // the tower, and RYU's radius
  const inner = -(D/2) + 0.5;                  // the inside face of the back wall
  const winH=Math.min(3.0,(H-3)/2.7);
  const top = Math.round((H*(0.30+0.34)-winH/2-0.2)*10)/10;
  const spread = 1 + top/PRad;                 // how far a rider drifts out by then
  const backOfCar = z1*spread;
  assert.ok(backOfCar > inner,
    `the back of the lift car reaches ${backOfCar.toFixed(2)} at the top floor, `
    + `past the wall's inner face at ${inner} — a rider would arrive inside it and be stuck`);
});

test('the E-45 turns because she is banked, not because a key is down', ()=>{
  /* IT USED TO BE A TILLER. Press A and the heading rotated at exactly
     AIR.turn from that frame; release it and it stopped dead, on the
     frame. The roll was then worked out FROM the turn you were already
     making and eased in over a quarter of a second — so she leaned into a
     corner she had finished taking. Nothing about that is flying: it is a
     sprite being spun with a lean painted on late.

     The bank is the cause now and the turn is the effect, which is the
     right way round and the only one without a snap in it: there is a
     physical quantity in between that cannot change instantly. */
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

  /* THE OLD MODEL IS GONE. A constant-rate turn straight off the key is
     the thing being fixed. */
  assert.ok(!/if\(turn\)\s*me\.fwd\.applyAxisAngle\(up,\s*AIR\.turn\*turn\*dt\)/.test(bare),
    'the heading is still driven straight off the key at a constant rate');

  /* THE ROLL IS A STATE WITH INERTIA, and the turn is read out of it. */
  assert.match(bare, /me\.roll \+= \(stick\*AIR\.bank\*fast - me\.roll\)/,
    'the roll is not eased toward what the stick is asking for');
  assert.match(bare, /Math\.sin\(me\.roll\)\/Math\.sin\(AIR\.bank\)/,
    'the turn rate is not derived from the roll');
  assert.match(bare, /me\.fwd\.applyAxisAngle\(up, turnRate\*dt\)/,
    'the derived rate never actually turns her');

  /* AND IT NEEDS AIR OVER THE WINGS, or she pivots on the spot. */
  assert.match(bare, /const fast=Math\.min\(1, Math\.abs\(me\.air\)\/12\)/,
    'the turn has full authority at a standstill');

  /* THE MOUSE LEANS HER WITHOUT FLYING HER. Steering with the mouse has
     already turned the heading; what it adds is a lean, kept in its own
     number so the two never fight and the turn is never counted twice. */
  assert.match(bare, /me\.lean \+= \(swing\*AIR\.bank\*fast - me\.lean\)/,
    'the mouse no longer leans her, or leans her through the roll');
  assert.match(bare, /me\.bank = me\.roll \+ me\.lean/,
    'what gets drawn is not the roll plus the lean');

  /* Both new numbers are cleared wherever the old one was, or a landing
     leaves her tipped over on the ground. */
  const resets=(bare.match(/me\.bank=0; me\.roll=0; me\.lean=0;/g)||[]).length;
  const banks =(bare.match(/me\.bank=0/g)||[]).length;
  assert.strictEqual(resets, banks,
    'somewhere resets the bank without resetting the roll and the lean');

  /* THE SHAPE OF THE RESPONSE, worked from the constants rather than
     asserted about them: pressing the stick must build the turn over
     several frames and releasing it must wash it out, with neither end
     reaching full rate in one frame. */
  /* READ OUT OF THE AIR BLOCK, not out of the file. `turn:` and `bank:`
     both appear earlier in planet.js on unrelated objects, so a bare
     search found `turn:0` and `bank:0` and this test passed a flight
     model with no turn in it. Anchor to the thing being measured. */
  const airBlock = planet.slice(planet.indexOf('const AIR={'),
                                planet.indexOf('const ceilingOf'));
  assert.ok(airBlock, 'the AIR block has been renamed');
  const num = k => {
    const m = airBlock.match(new RegExp('\\b'+k+':(-?[\\d.]+)'));
    assert.ok(m, `AIR has no ${k}`);
    return +m[1];
  };
  const A = { turn:num('turn'), bank:num('bank'), roll:num('roll') };
  assert.ok(A.turn>0 && A.bank>0 && A.roll>0, 'a flight constant read as zero');
  const dt=1/60;
  const rateAfter = (held, frames) => {
    let roll=0;
    for(let i=0;i<frames;i++){
      const stick = i<held ? 1 : 0;
      roll += (stick*A.bank - roll)*Math.min(1, dt*A.roll);
    }
    return (Math.sin(roll)/Math.sin(A.bank))*A.turn;
  };
  assert.ok(rateAfter(1,1) < A.turn*0.1,
    'one frame of stick already turns her at most of full rate: the snap is back');
  assert.ok(rateAfter(60,60) > A.turn*0.7,
    'a second of stick never builds a proper turn');
  assert.ok(rateAfter(30,60) < rateAfter(30,31),
    'the turn does not wash out after the stick is released');
});
