/* =====================================================================
   THE KEY SLOT, under test.

   A key slot used to be a plain text box, and a text box is wrong in two
   separate ways at once. It lets a student type `Shift` or `spacebar` —
   words that read perfectly well inside the block, match no key, and fire
   nothing, with nothing on screen to say why. And because the editor
   makes every typing box a drop target, it let a BLOCK land in it: drop
   `key [space] pressed?` on the hat's key field and you get

       when ‹key (space) pressed?› key pressed

   which is not a program. Both halves are the same mistake — a field that
   holds one of a fixed set of names is a MENU — so both are tested here.

   blocks.js is a browser global, so it is read as source and run in a
   scratch context, the same way the rest of the suite handles those.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TEMPLATES = require('../public/templates.js');

const P = f => path.join(__dirname,'..',f);
const read = f => fs.readFileSync(P(f),'utf8');
function globals(files){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  files.forEach(f=>vm.runInContext(read(f), ctx, { filename:f }));
  return ctx;
}
const BLOCKS = globals(['public/blocks.js']).BLOCKS;

/* every slot in the language, as {op, key, spec} */
function slots(){
  const out=[];
  BLOCKS.LIST.forEach(bd=>Object.entries(bd.args||{}).forEach(
    ([k,sp])=>out.push({ op:bd.op, k, sp })));
  return out;
}

/* ==================================================================== */
test('every name the key menu offers is a key the VM can ask about', ()=>{
  BLOCKS.KEYS.forEach(o=>{
    assert.ok(o.v && o.name, 'a key menu entry is missing its value or its label');
    assert.ok(BLOCKS.keyCode(o.v),
      o.v+' is on the key menu and maps to no keyboard code');
  });
});

test('no two entries on the key menu are the same key', ()=>{
  const seen=new Map();
  BLOCKS.KEYS.forEach(o=>{
    const c=BLOCKS.keyCode(o.v);
    assert.ok(!seen.has(c), o.v+' and '+seen.get(c)+' are both '+c);
    seen.set(c,o.v);
  });
});

test('the menu is the whole keyboard a student would reach for', ()=>{
  const have=new Set(BLOCKS.KEYS.map(o=>o.v));
  ['space','up','down','left','right','any'].forEach(k=>
    assert.ok(have.has(k), 'the key menu is missing '+k));
  'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(k=>
    assert.ok(have.has(k), 'the key menu is missing '+k));
});

test('a name that is not a key reads as no key at all, and never throws', ()=>{
  ['Shift','ctrl','spacebar!','','  ','up up', null, undefined, 42, {}]
    .forEach(k=>{
      const c=BLOCKS.keyCode(k);
      assert.strictEqual(typeof c, 'string');
      if(c) assert.ok(BLOCKS.KEYS.some(o=>BLOCKS.keyCode(o.v)===c),
        JSON.stringify(k)+' resolved to '+c+', which is off the menu');
    });
  /* the ones a student might type, spelled the way the block reads them */
  assert.strictEqual(BLOCKS.keyCode('up arrow'), BLOCKS.keyCode('up'));
  assert.strictEqual(BLOCKS.keyCode('SPACE'),    BLOCKS.keyCode('space'));
});

test('a menu slot holds a name, never a block', ()=>{
  slots().forEach(({op,k,sp})=>{
    if(sp.type==='num'||sp.type==='str'||sp.type==='bool')
      assert.ok(BLOCKS.holdsBlock(sp), op+' %'+k+' should take a reporter');
    else
      assert.ok(!BLOCKS.holdsBlock(sp),
        op+' %'+k+' is a '+sp.type+' menu and must not accept a block');
  });
});

/* THE ONE THAT WOULD HAVE CAUGHT IT. `key` had no branch in the editor's
   slotHTML, so it fell through to the generic typing box — which is where
   both bugs came from. Any new slot type added to the language without a
   way to draw it lands in the same hole, silently. */
test('every slot type in the language is drawn by the editor', ()=>{
  const src=read('public/coder.js');
  const types=new Set(slots().map(x=>x.sp.type));
  types.forEach(t=>{
    if(t==='num'||t==='str') return;         // these two ARE the typing box
    assert.ok(src.includes("sp.type==='"+t+"'"),
      "coder.js has no way to draw a '"+t+"' slot, so it will render as a text box");
  });
});

test('the editor draws a key slot as a menu, and not as a drop target', ()=>{
  const src=read('public/coder.js');
  const m=src.match(/if\(sp\.type==='key'\)([\s\S]*?)\n    if\(/);
  assert.ok(m, "coder.js does not draw a key slot");
  assert.ok(m[1].includes('<select'), 'a key slot is not a dropdown');
  assert.ok(!m[1].includes('data-slot'),
    'a key slot carries data-slot, which is what makes it a drop target');
});

test('every key the worked combos press is on the menu', ()=>{
  const have=new Set(BLOCKS.KEYS.map(o=>o.v));
  const walk=bk=>{
    if(!bk || typeof bk!=='object') return;
    if(Array.isArray(bk)) return bk.forEach(walk);
    if(bk.op==='sense.key'||bk.op==='event.key')
      assert.ok(have.has(String((bk.args||{}).k)),
        bk.op+' in a template presses "'+(bk.args||{}).k+'", which is off the menu');
    Object.values(bk.args||{}).forEach(walk);
    walk(bk.body); walk(bk.body2);
  };
  TEMPLATES.LIST.forEach(tp=>{
    (tp.scripts||[]).forEach(walk);
    (tp.body||[]).forEach(walk);
    Object.values(tp).forEach(v=>Array.isArray(v)&&walk(v));
  });
});
