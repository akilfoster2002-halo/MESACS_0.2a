/* A walkthrough that never ran, and a highlight that moved what it pointed at.

   Two failures with the same shape: nothing threw, nothing logged, and the
   only symptom was a nine-year-old sitting in front of a grid with no idea
   what to press.

   The first: public/school.js declared `function walk()` for the coached
   first level and, forty lines later, `function walk(steps, at)` for the
   step runner. In one scope the second declaration silently replaces the
   first, so `if(K.walk) walk()` called the RUNNER with no arguments, which
   returns on its own first line. The level asked for its walkthrough and
   got nothing back.

   The second: `.coach-target` set `position:relative` and animated
   `transform`, and the Code Console button — the very first thing the
   walkthrough points at — is `position:absolute` and centred with
   `transform:translateX(-50%)`. Lighting it up moved it off the top of the
   screen and 108px to the left of where the ring was drawn. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Every top-level `function name(` in a file, with how many times it is
   declared. Crude — it does not know about nesting — which is the point:
   two same-named declarations at two indents that look alike is exactly the
   case a reader misses. */
function declarations(src){
  const seen = {};
  const re = /^(\s*)function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while((m = re.exec(src))) seen[m[2]] = (seen[m[2]] || 0) + 1;
  return seen;
}

test('school.js declares no function name twice', ()=>{
  const dup = Object.entries(declarations(read('public/school.js')))
    .filter(([,n]) => n > 1).map(([k]) => k);
  assert.deepStrictEqual(dup, [],
    'a second declaration of the same name replaces the first, silently');
});

test('the coached level calls the coach and not the step runner', ()=>{
  const src = read('public/school.js');
  assert.match(src, /if\(K\.walk\)\s*coach\(\)/,
    'level one asks for its walkthrough by name');
  assert.match(src, /function coach\(\)/, 'and something answers to that name');
});

test('every level flagged walk:true has a walkthrough to run', ()=>{
  const src = read('public/school.js');
  const walked = (src.match(/walk:\s*true/g) || []).length;
  assert.ok(walked >= 1, 'at least one level is walked');
  assert.ok(/COACH\.start\(/.test(src), 'and the walkthrough actually starts COACH');
});

test('the walkthrough points at selectors the console renders', ()=>{
  const school = read('public/school.js');
  const code   = read('public/code.js');
  /* the shelf, the number box and the run button, as school.js names them */
  for(const sel of ['[data-add=', '.numin', '#conRun']){
    assert.ok(school.includes(sel), `school.js points at ${sel}`);
    assert.ok(code.includes(sel.replace('[data-add=', 'data-add=')
                               .replace('.numin', 'numin')
                               .replace('#conRun', 'conRun')),
      `code.js still renders ${sel}`);
  }
});

test('the highlight does not move what it highlights', ()=>{
  const css = read('public/index.html');
  const rule = css.match(/\.coach-target\{([^}]*)\}/);
  assert.ok(rule, 'index.html still styles .coach-target');
  assert.ok(!/position\s*:/.test(rule[1]),
    '.coach-target must not set position — the Code Console button is absolute');

  const lift = css.match(/@keyframes coachLift\{([\s\S]*?)\n\}/);
  assert.ok(lift, 'index.html still defines coachLift');
  assert.ok(!/transform\s*:/.test(lift[1]),
    'coachLift must animate translate/scale, which compose with an element\'s own transform');
});

test('COACH gives a static target its position back afterwards', ()=>{
  const src = read('public/coach.js');
  assert.match(src, /getComputedStyle\(el\)\.position==='static'/,
    'position is set inline, and only where there was none');
  assert.match(src, /el\.style\.position=''/, 'and taken off again');
});

test('the console button is available in the missions that are only a console', ()=>{
  const src = read('public/game.js');
  const m = src.match(/const flying\s*=([\s\S]*?)const usable\b/);
  assert.ok(m, 'game.js still decides who may open the console');
  for(const who of ['FLIGHT', 'SUB', 'SCHOOL'])
    assert.ok(m[1].includes(who), `${who} runs with G.running off and needs the console`);
});
