/* THE ASK PANEL, AS A WINDOW YOU CAN MOVE.

   It was pinned to the bottom-right corner, which is the one place it is
   guaranteed to be in the way: the editor's script column is on the right,
   so the panel sat on top of the blocks it was being asked about. You
   cannot read a hint about your own `forever` loop through the box giving
   the hint.

   So it is dragged by its title bar, rolled up to that bar, and resized.
   Three things have to hold, and two of them are the kind that only show
   up in front of a child:

     IT CANNOT BE LOST. Dragged past any edge, a piece of the title bar
     stays on screen and stays grabbable. A window shoved off the top-left
     with no way to reach it again is a window a nine-year-old never gets
     back, and there is no "reset window position" menu in this game.

     THE BUTTONS IN THE TITLE BAR ARE BUTTONS. The bar is the drag handle,
     and the close and minimise controls live on it — press one, move the
     mouse a hair, and without a guard you have dragged the window instead
     of pressing the button.

     AND IT IS NOT SAVED. Nothing in the ring is, including this.

   Source-level: the behaviour is a pointer drag against a live layout, and
   what these guard is that the rules above are still written down. The live
   half — dragging it to all four edges and finding it again — was checked in
   the browser. Comments are stripped first so the paragraphs above cannot
   make this pass. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const ASK  = bare(read('public/ask.js'));
const HTML = read('public/index.html');
/* the stylesheet, with its comments gone for the same reason */
const CSS  = HTML.replace(/\/\*[\s\S]*?\*\//g,'');

test('the title bar is the handle', ()=>{
  assert.match(ASK, /function grab\(handle\)/, 'something makes a handle draggable');
  assert.match(ASK, /grab\(\$\('#tutGrab'\)\)/, 'and the title bar is what gets it');
  assert.match(ASK, /id="tutGrab"/, 'which exists in the panel it renders');
  /* re-armed on every render, because render() replaces the node */
  const render = /function render\(\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  assert.match(render, /grab\(/, 'and it is re-armed each time the panel is rebuilt');
});

test('the buttons on the title bar are not the handle', ()=>{
  const fn = /function grab\(handle\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  assert.match(fn, /if\(e\.target\.closest\('button'\)\) return;/,
    'pressing close or minimise must not start a drag');
});

test('a drag captures the pointer and lets it go again', ()=>{
  const fn = /function grab\(handle\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  assert.match(fn, /setPointerCapture/,
    'or the drag dies the moment the cursor outruns the title bar');
  assert.match(fn, /releasePointerCapture/, 'and it is handed back on drop');
  assert.match(fn, /onpointermove=null/, 'with the move handler taken off');
  assert.match(fn, /onpointercancel/,
    'a cancelled pointer has to drop it too, or it sticks to the cursor');
});

test('it switches from corner-anchored to positioned on the first drag', ()=>{
  const fn = /function put\(el, at\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  assert.match(fn, /style\.left=/,  'a dragged window is a left/top');
  assert.match(fn, /style\.top =|style\.top=/, '');
  /* Both corner anchors have to go. Setting left while right is still 10px
     stretches the window across the screen instead of moving it. */
  assert.match(fn, /style\.right='auto'/,  'and the corner anchors are released');
  assert.match(fn, /style\.bottom='auto'/, '');
  assert.match(CSS, /#tutor\{position:absolute;right:10px;bottom:10px/,
    'until then it stays in its corner as the window resizes');
});

test('it cannot be dragged somewhere it cannot be got back from', ()=>{
  assert.match(ASK, /const EDGE=\d+/, 'there is a margin that must stay reachable');
  const fn = /function clamp\(left, top, el\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  /* Left may go negative — most of the window off the left edge is fine —
     but never further than leaves EDGE of it showing. */
  assert.match(fn, /Math\.max\(EDGE-w,\s*Math\.min\(left,\s*innerWidth-EDGE\)\)/,
    'a strip stays on screen at both sides');
  /* Top is different, and deliberately: the handle is the TOP of the
     window, so letting it go negative puts the one grabbable part above
     the screen with the rest of the window hanging below it. */
  assert.match(fn, /Math\.max\(0,\s*Math\.min\(top,\s*innerHeight-EDGE\)\)/,
    'and the title bar itself never goes above the top of the screen');
});

test('and it is checked again when the screen changes size', ()=>{
  assert.match(ASK, /addEventListener\('resize',\(\)=>\{[\s\S]*?put\(el, clamp\(placed\.left, placed\.top, el\)\)/,
    'a window left where a smaller screen no longer has is a lost window');
  const show = /function show\(\)\{[\s\S]*?\n  \}/.exec(ASK)[0];
  assert.match(show, /if\(placed\) put\(el, clamp\(/,
    'and re-opening it puts it back where it was, on screen');
});

test('minimising leaves the title bar and nothing else', ()=>{
  assert.match(ASK, /let rolled=false/, 'it knows whether it is rolled up');
  assert.match(ASK, /el\.classList\.toggle\('rolled', rolled\)/, 'and says so in a class');
  assert.match(ASK, /\$\('#tutMin'\)\.onclick=\(\)=>\{ rolled=!rolled; render\(\); \}/,
    'the minimise button toggles it');
  assert.match(CSS, /#tutor\.rolled \.tut-log,#tutor\.rolled \.tut-ask\{display:none\}/,
    'the log and the question box go');
  /* min-height and the resize grip both have to stand down or it springs
     back open the moment it is rolled. */
  assert.match(CSS, /#tutor\.rolled\{height:auto!important;min-height:0;resize:none\}/,
    'and nothing holds it open');
});

test('it can be resized, but not to a sliver', ()=>{
  assert.match(CSS, /#tutor\{[^}]*resize:both/, 'the corner grip is on');
  assert.match(CSS, /#tutor\{[^}]*min-width:250px/, 'with a floor under the width');
  assert.match(CSS, /#tutor\{[^}]*min-height:120px/, 'and under the height');
});

test('the panel takes its own clicks', ()=>{
  /* #coder is pointer-events:none so the world shows through it, and every
     panel inside it has to turn them back on for itself. This one did not,
     and the whole window — text box included — was click-through: the
     report was "i cant seem to clikc the text box". */
  assert.match(CSS, /#tutor\{[^}]*pointer-events:auto/,
    'or every click goes straight through it to the world');
});

test('where it was put is not saved anywhere', ()=>{
  assert.match(ASK, /let placed=null/, 'the position lives in a variable');
  const code = ASK;
  assert.ok(!/localStorage/.test(code) && !/PROGRESS\.set/.test(code),
    'and nowhere else: the next child on this machine should not inherit '+
    'where somebody else left the window');
});
