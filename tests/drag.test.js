/* DRAGGING BLOCKS.

   Blocks in the program could already be dragged — reordered, into a loop,
   out of one — and the shelf could only be clicked, which put every new
   block at the end and left "where does it go" as a second job. Now the
   shelf is dragged from too, with the same ghost and the same drop line,
   and a block dragged back onto the shelf is let go of. These read the
   console's source for the shape of that, since the console is a browser
   file that touches the DOM at load. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const code = read('public/code.js');
const dragSrc = code.slice(code.indexOf('----- dragging'), code.indexOf('function wireDrag('));
const wire = code.slice(code.indexOf('function wireDrag('), code.indexOf('function wireDrag(')+900);

test('the shelf is picked up from, not only clicked', ()=>{
  assert.match(wire, /paletteEl\.querySelectorAll\('\[data-add\]'\)\.forEach\(node=>\{\s*node\.onpointerdown=/,
    'shelf buttons have no pointerdown — they can only be clicked');
  assert.match(wire, /shelf:\{ type:node\.dataset\.add, n:/, 'a shelf drag does not carry what to make');
  assert.match(read('public/index.html'), /#conPalette \.palblk\{cursor:grab;touch-action:none\}/,
    'a touch on a shelf button scrolls instead of dragging');
});

test('a shelf block is made at the drop, through the same budget as a click', ()=>{
  /* Made at the drop, not the pickup: a drag that comes back to the shelf
     has made nothing, and a full budget says so where the block would have
     landed. And the same newBlock() a click uses, so the two ways onto the
     shelf cannot disagree about the budget. */
  assert.match(code, /function newBlock\(type, n\)\{[\s\S]*?Out of blocks/, 'no shared newBlock() with the budget check');
  assert.match(code, /function addBlock\(type, n\)\{\s*const b=newBlock\(type, n\)/, 'a click no longer goes through newBlock()');
  assert.match(dragSrc, /if\(shelf\)\{[\s\S]*?const nb=newBlock\(shelf\.type, shelf\.n\); if\(!nb\) return;/,
    'a shelf drop does not make the block through newBlock(), or redraws over the refusal');
  assert.match(dragSrc, /if\(shelf\)\{[\s\S]*?if\(!slot\) return draw\(\);/, 'a shelf drag put back on the shelf still makes a block');
});

test('a block dragged back onto the shelf is let go of, and the click that ends the drag is not a click', ()=>{
  assert.match(dragSrc, /drag\.onShelf=overShelf\(ev\)/, 'the drag does not notice the shelf');
  assert.match(dragSrc, /if\(!slot\)\{\s*if\(onShelf\)\{ removeBlock\(b\.id\)/, 'a program block dropped on the shelf is not removed');
  assert.match(dragSrc, /discard/, 'the ghost gives no sign it is about to be let go of');
  /* the browser turns a pointerup over a shelf button into a click on it,
     which would add a fresh block the moment you let go of an old one */
  assert.match(dragSrc, /if\(got\.shelf\)\{ swallowClick=true; setTimeout\(\(\)=>\{ swallowClick=false; \}, 0\); \}/,
    'the click made out of a drag\'s release is not swallowed');
  assert.match(code, /if\(swallowClick\)\{ swallowClick=false; return; \}\s*addBlock\(/, 'the shelf click does not check the swallow flag');
});

test('the shelf says it can be dragged, in both languages', ()=>{
  const es=read('public/strings.js');
  for(const k of ['Click a block to add it — or drag it where you want it.',
                  'Click a block on the left — or drag one here.'])
    assert.ok(es.indexOf("'"+k+"'")>=0, `no Spanish for: ${k}`);
});
