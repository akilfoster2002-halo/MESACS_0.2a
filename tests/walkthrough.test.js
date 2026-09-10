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

/* NORTH HAS TO BE UP.

   Flight School's headings are degrees counterclockwise from east, which is
   what they are in a maths lesson: east 0, north 90. The board is read from
   directly above with the camera's up vector pointing along world -z, so up
   the screen IS -z, and the ship's nose must go there when the heading says
   90.

   It did not. three.js turns +x toward -z as an angle grows — (1,0,0)
   becomes (cos a, 0, -sin a) — and the heading was being applied negated,
   which sent the nose to +z. The ship faced south every time the mission
   said north, and the two turn directions came out backwards with it.

   Nothing else was wrong, which is why nobody caught it: `turn 90` really
   was ninety degrees counterclockwise from east, judge() compared the right
   numbers, and the level was marked CORRECT while the picture showed the
   opposite. Only the drawing was mirrored.

   So this is not a string match on the fix. It reads the two conventions
   out of school.js — which way the rows are laid out, and what sign the
   heading is applied with — and works out where the nose actually ends up. */
function schoolConventions(){
  const src = read('public/school.js');

  const pz = src.match(/const pz\s*=\s*y\s*=>\s*(-?)/);
  assert.ok(pz, 'school.js no longer maps rows to z with a pz()');
  const rowSign = pz[1] === '-' ? -1 : 1;      // world z per +1 of row

  const lay = src.slice(src.indexOf('function lay('), src.indexOf('function lay(') + 900);
  const rot = lay.match(/ship\.rotation\.y\s*=\s*(-?)ta/);
  assert.ok(rot, 'lay() no longer sets ship.rotation.y from ta');
  const headSign = rot[1] === '-' ? -1 : 1;

  const up = src.match(/G\.camera\.up\.set\(0,\s*0,\s*(-?1)\)/);
  assert.ok(up, 'the board is no longer read with a z-axis camera up vector');
  return { rowSign, headSign, screenUpZ: +up[1] };
}

test('north is up the screen, and so is a bigger row number', ()=>{
  const { rowSign, headSign, screenUpZ } = schoolConventions();

  /* Up the screen, in world z. */
  assert.strictEqual(screenUpZ, -1,
    'the camera reads the board with -z up; the rest of this assumes it');

  // a bigger y must go UP, or the grid is upside down before anything moves
  assert.strictEqual(Math.sign(rowSign), Math.sign(screenUpZ),
    'row 4 must be higher up the screen than row 0');

  /* Where the nose points, for a heading of `deg` counterclockwise from
     east. The model's nose is +x in the ship group's frame, and three.js
     rotates (1,0,0) to (cos t, 0, -sin t). */
  const nose = deg => {
    const t = headSign * deg * Math.PI/180;
    return { x: Math.cos(t), z: -Math.sin(t) };
  };
  const near = (a,b) => Math.abs(a-b) < 1e-9;

  const east = nose(0), north = nose(90), west = nose(180), south = nose(270);
  assert.ok(near(east.x, 1) && near(east.z, 0),   'east points along +x, to the right');
  assert.ok(near(north.z, screenUpZ),             'NORTH POINTS UP THE SCREEN');
  assert.ok(near(west.x, -1),                     'west points left');
  assert.ok(near(south.z, -screenUpZ),            'and south points down');

  /* And the turn the brief promises: `turn 90` takes you from facing east
     to facing north, which on a board with north up is counterclockwise. */
  assert.ok(near(nose(45).z, screenUpZ*Math.SQRT1_2) && nose(45).x > 0,
    'forty-five degrees is halfway between east and north, as the level says');
});
