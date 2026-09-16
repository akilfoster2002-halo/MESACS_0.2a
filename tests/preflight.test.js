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
  assert.match(planet, /if\(id==='ship'\)\{[\s\S]{0,200}SHIPFIX\.open\(/,
    'E at the ship does not open the checklist');
  assert.match(planet, /ships\/e45\.glb\?v=' \+ \(window\.ASSETV/,
    'the ship model is fetched without ?v=ASSETV: a changed model will not reach anybody');
  /* THE ROVER IS RETIRED, and its lesson with it. A file left on the page
     that nothing routes is a second vehicle mission nobody can reach. */
  for(const f of ['public/rover.js','public/garage.js'])
    assert.ok(!fs.existsSync(path.join(__dirname,'..',f)), f+' is still here');
  const html = read('public/index.html');
  assert.ok(!/rover\.js|garage\.js/.test(html), 'index.html still loads the rover');
  for(const f of ['preflight.js','shipfix.js'])
    assert.match(html, new RegExp(`<script src="${f}\\?v=\\d+"></script>`), f+' is not on the page');
});

test('the model is installed and carries its own colour', ()=>{
  const file = path.join(__dirname, '..', 'public/ships/e45.glb');
  assert.ok(fs.existsSync(file), 'e45.glb is installed');
  const b = fs.readFileSync(file);
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const prim = json.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0,
    'the E-45 has no vertex colours — nothing in this game ships a texture, so it would render white');
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
